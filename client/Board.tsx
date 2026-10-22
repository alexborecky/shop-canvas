import {
	CaptureUpdateAction,
	Excalidraw,
	getCommonBounds,
	MainMenu,
	viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { DEFAULT_APP_STATE, HIDDEN_TOOLS, UI_OPTIONS } from './boardConfig'
import type { Identity } from './identity'
import { getLocalStorageItem, setLocalStorageItem } from './localStorage'
import { addSticky, mountStickyOverlay } from './stickies'
import { StickyStack } from './StickyStack'
import { bindExcalidraw } from './sync/bindExcalidraw'
import type { BoardDoc } from './sync/useBoardDoc'

type Binding = ReturnType<typeof bindExcalidraw>

const HIDDEN_TOOLS_CSS =
	[
		...HIDDEN_TOOLS.map((t) => `.Board label:has(> [data-testid="toolbar-${t}"])`),
		'.Board label.ToolIcon__lock', // "keep tool active" toggle
		'.Board .App-toolbar .App-toolbar__divider', // separators next to the hidden lock / extra-tools buttons
		'.Board .App-toolbar__extra-tools-trigger', // "more tools" (frames, embeds, AI, mermaid...)
		'.Board .default-sidebar-trigger', // library sidebar
		'.Board .UserList__wrapper', // collaborator avatars: shown in our top-right toolbar instead
	].join(',\n') + ' { display: none !important; }'

/** Toolbar at the bottom of the canvas instead of the top (Excalidraw positions it via `.App-menu_top`). */
const BOTTOM_TOOLBAR_CSS = `
.Board .App-menu_top .shapes-section { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }
.Board .App-toolbar .HintViewer { top: auto; bottom: 100%; margin: 0 0 .5rem; }
/* the row stretches its items to the tallest one (our sticky pad); keep the tool island hugging its buttons */
.Board .App-toolbar-container { align-items: flex-end; }
.Board .App-toolbar-container > .App-toolbar { height: fit-content; }
`

/** Our toolbars at the top, styled as islands like the tool bar. Top-left: menu button + `menuBar`. */
const TOP_TOOLBARS_CSS = `
.Board .App-menu_top__left > div:first-child {
	display: flex; align-items: center; gap: 4px; width: fit-content; padding: 4px;
	background: var(--island-bg-color); box-shadow: var(--shadow-island); border-radius: var(--border-radius-lg);
}
.Board .App-menu_top__left .main-menu-trigger {
	width: var(--default-button-size); height: var(--default-button-size); padding: .5rem;
	background: none; box-shadow: none;
}
.Board .App-menu_top__left .main-menu-trigger:hover { background: var(--color-surface-high); }
.Board .BoardMenuBar { display: flex; align-items: center; gap: 4px; padding-left: 4px; }
/* the tool bar left the middle grid column (BOTTOM_TOOLBAR_CSS): split the top row between our two toolbars */
.Board .App-menu_top { grid-template-columns: 1fr 1fr; }
.Board .layer-ui__wrapper__top-right { grid-column: 2; }
`

const SHOW_AUTHORS_KEY = 'shoptet-canvas:show-sticky-authors'

type Overlay = ReturnType<typeof mountStickyOverlay>

type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number]

const OUTLINE_TYPES = new Set(['rectangle', 'diamond', 'ellipse'])

/** A closed shape Excalidraw only hit-tests on its stroke: no fill and no text inside. */
const isOutlineShape = (el: SceneElement) =>
	OUTLINE_TYPES.has(el.type) &&
	(el.backgroundColor === 'transparent' || /^#[0-9a-f]{6}00$/i.test(el.backgroundColor)) &&
	!el.boundElements?.some((b) => b.type === 'text')

/** Is the scene point inside the shape's area (rotation included)? */
function isInsideShape(el: SceneElement, x: number, y: number) {
	const hw = el.width / 2
	const hh = el.height / 2
	if (!hw || !hh) return false
	const cos = Math.cos(-el.angle)
	const sin = Math.sin(-el.angle)
	const px = x - (el.x + hw)
	const py = y - (el.y + hh)
	const dx = Math.abs((px * cos - py * sin) / hw)
	const dy = Math.abs((px * sin + py * cos) / hh)
	if (el.type === 'ellipse') return dx * dx + dy * dy <= 1
	if (el.type === 'diamond') return dx + dy <= 1
	return dx <= 1 && dy <= 1
}

/**
 * Click anywhere inside an unfilled rectangle/diamond/ellipse to select (and drag) it, not just on
 * its outline. Excalidraw has no option for this, so just before its canvas sees the pointerdown we
 * select the shape ourselves; Excalidraw then treats the press as a hit on a selected element.
 */
function enableSelectInsideOutlines(api: ExcalidrawImperativeAPI, root: HTMLElement) {
	// how far around a selection its resize/rotate handles reach, in screen px
	const HANDLE_MARGIN = 40

	const onPointerDown = (e: PointerEvent) => {
		const target = e.target as HTMLElement
		if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
		if (!target.classList.contains('interactive')) return // only the canvas itself, not UI on top
		const s = api.getAppState()
		if (s.activeTool.type !== 'selection' || s.editingTextElement) return
		const { x, y } = viewportCoordsToSceneCoords({ clientX: e.clientX, clientY: e.clientY }, s)

		const elements = api.getSceneElements()
		// pressing on (or around) the current selection is Excalidraw's: drag, resize, rotate
		const selected = elements.filter((el) => s.selectedElementIds[el.id])
		if (selected.length) {
			const m = HANDLE_MARGIN / s.zoom.value
			const [x1, y1, x2, y2] = getCommonBounds(selected)
			if (x >= x1 - m && x <= x2 + m && y >= y1 - m && y <= y2 + m) return
		}

		// topmost element under the pointer; lines/arrows/freehand are hit on their stroke, so look through them
		let shape: SceneElement | undefined
		for (let i = elements.length - 1; i >= 0; i--) {
			const el = elements[i]
			if (el.locked || el.type === 'arrow' || el.type === 'line' || el.type === 'freedraw') continue
			if (isOutlineShape(el)) {
				if (isInsideShape(el, x, y)) {
					shape = el
					break
				}
				continue
			}
			const [x1, y1, x2, y2] = getCommonBounds([el])
			if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return // something solid on top: Excalidraw decides
		}
		if (!shape) return

		// grouped shapes select their whole (outermost) group, as a click on the outline would
		const groupId = s.editingGroupId ? undefined : shape.groupIds.at(-1)
		const ids = groupId ? elements.filter((el) => el.groupIds.includes(groupId)).map((el) => el.id) : [shape.id]
		// synchronously, so Excalidraw's own pointerdown handler already sees the selection
		flushSync(() =>
			api.updateScene({
				appState: {
					selectedElementIds: Object.fromEntries(ids.map((id) => [id, true as const])),
					selectedGroupIds: groupId ? { [groupId]: true } : {},
				},
				captureUpdate: CaptureUpdateAction.NEVER,
			}),
		)
	}

	root.addEventListener('pointerdown', onPointerDown, true)
	return () => root.removeEventListener('pointerdown', onPointerDown, true)
}

/** The canvas. Everything Excalidraw-specific stays in this file + sync/bindExcalidraw.ts. */
export function Board({
	board,
	boardId,
	identity,
	menuBar,
	toolbar,
}: {
	board: BoardDoc
	boardId: string
	identity: Identity
	/** shown next to the main menu button, top-left */
	menuBar: ReactNode
	/** the top-right toolbar */
	toolbar: ReactNode
}) {
	const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
	const binding = useRef<Binding | null>(null)
	const root = useRef<HTMLDivElement>(null)
	const overlay = useRef<Overlay | null>(null)
	// where the sticky pad is portalled into Excalidraw's toolbar row
	const [stackHost] = useState(() => document.createElement('div'))
	// where `menuBar` is portalled, right after the main menu button
	const [menuHost] = useState(() => {
		const el = document.createElement('div')
		el.className = 'BoardMenuBar'
		return el
	})
	// per viewer: names on stickies can be hidden from the main menu
	const [showAuthors, setShowAuthors] = useState(() => getLocalStorageItem(SHOW_AUTHORS_KEY) !== 'false')
	const showAuthorsRef = useRef(showAuthors)

	useEffect(() => {
		if (!api) return
		const b = bindExcalidraw(api, board, boardId, identity)
		binding.current = b
		// handy for debugging in the browser console during `npm run dev`
		if (import.meta.env.DEV) Object.assign(window, { excalidrawAPI: api, boardDoc: board.doc })
		return () => {
			b.dispose()
			binding.current = null
		}
		// identity changes are pushed separately below; don't rebind for them
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [api, board, boardId])

	useEffect(() => {
		binding.current?.setIdentity(identity)
	}, [identity])

	useEffect(() => {
		if (!api || !root.current) return
		const o = mountStickyOverlay(api, root.current, { showAuthors: () => showAuthorsRef.current })
		overlay.current = o
		return () => {
			o.dispose()
			overlay.current = null
		}
	}, [api])

	useEffect(() => {
		showAuthorsRef.current = showAuthors
		setLocalStorageItem(SHOW_AUTHORS_KEY, String(showAuthors))
		overlay.current?.redraw()
	}, [showAuthors])

	useEffect(() => {
		if (api && root.current) return enableSelectInsideOutlines(api, root.current)
	}, [api])

	// Keep the sticky pad right after the tool island, and the menu bar right after the menu button;
	// Excalidraw re-mounts those now and then.
	useEffect(() => {
		if (!api || !root.current) return
		const container = root.current
		const placeAfter = (host: HTMLElement, selector: string) => {
			if (host.isConnected) return
			const anchor = container.querySelector(selector)
			// insertBefore, not .after(): the Worker types' HTMLRewriter Element shadows the DOM signature
			anchor?.parentNode?.insertBefore(host, anchor.nextSibling)
		}
		const attach = () => {
			placeAfter(stackHost, '.App-toolbar-container > .App-toolbar')
			placeAfter(menuHost, '.App-menu_top__left .main-menu-trigger')
		}
		const unsubscribe = api.onChange(attach)
		const frame = requestAnimationFrame(attach)
		return () => {
			unsubscribe()
			cancelAnimationFrame(frame)
			stackHost.remove()
			menuHost.remove()
		}
	}, [api, stackHost, menuHost])

	const newSticky = () => api && addSticky(api, identity.name)

	// "S" (and "N") adds a sticky. Capture phase: Excalidraw handles S (stroke colour) first otherwise.
	const onKeyDownCapture = (e: React.KeyboardEvent) => {
		const key = e.key.toLowerCase()
		if (!api || (key !== 's' && key !== 'n') || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
		const target = e.target as HTMLElement
		if (target.closest('input, textarea, [contenteditable="true"]')) return
		if (api.getAppState().editingTextElement) return
		e.preventDefault()
		e.stopPropagation()
		newSticky()
	}

	return (
		<div className="Board" ref={root} onKeyDownCapture={onKeyDownCapture}>
			<style>{HIDDEN_TOOLS_CSS + BOTTOM_TOOLBAR_CSS + TOP_TOOLBARS_CSS}</style>
			<Excalidraw
				excalidrawAPI={setApi}
				isCollaborating
				initialData={{ appState: DEFAULT_APP_STATE }}
				UIOptions={UI_OPTIONS}
				onChange={(elements, appState, files) => binding.current?.onChange(elements, appState, files)}
				onPointerUpdate={(p) => binding.current?.onPointerUpdate(p)}
				renderTopRightUI={() => <div className="BoardToolbar">{toolbar}</div>}
			>
				<MainMenu>
					<MainMenu.ItemLink href="/">All boards</MainMenu.ItemLink>
					<MainMenu.Separator />
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.Item onSelect={() => setShowAuthors((v) => !v)}>
						{showAuthors ? 'Hide names on stickies' : 'Show names on stickies'}
					</MainMenu.Item>
					<MainMenu.DefaultItems.ChangeCanvasBackground />
					<MainMenu.DefaultItems.Help />
				</MainMenu>
			</Excalidraw>
			{createPortal(<StickyStack onClick={newSticky} />, stackHost)}
			{createPortal(menuBar, menuHost)}
		</div>
	)
}
