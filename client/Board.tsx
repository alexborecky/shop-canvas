import {
	CaptureUpdateAction,
	Excalidraw,
	getCommonBounds,
	MainMenu,
	viewportCoordsToSceneCoords,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
		'.Board .UserList__wrapper', // collaborator avatars: shown in the page header instead
	].join(',\n') + ' { display: none !important; }'

/** Toolbar at the bottom of the canvas instead of the top (Excalidraw positions it via `.App-menu_top`). */
const BOTTOM_TOOLBAR_CSS = `
.Board .App-menu_top .shapes-section { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }
.Board .App-toolbar .HintViewer { top: auto; bottom: 100%; margin: 0 0 .5rem; }
/* the row stretches its items to the tallest one (our sticky pad); keep the tool island hugging its buttons */
.Board .App-toolbar-container { align-items: flex-end; }
.Board .App-toolbar-container > .App-toolbar { height: fit-content; }
`

const SHOW_AUTHORS_KEY = 'shoptet-canvas:show-sticky-authors'

type Overlay = ReturnType<typeof mountStickyOverlay>

/**
 * Miro-style panning: with the select tool, press and drag on empty canvas moves the board.
 * Shift+drag still draws Excalidraw's selection box; a plain click on empty canvas still deselects.
 * Excalidraw has no option for this, so we catch the pointerdown before it reaches its canvas.
 */
function enableDragToPan(api: ExcalidrawImperativeAPI, root: HTMLElement) {
	// how far around a selection its resize/rotate handles reach, in screen px
	const HANDLE_MARGIN = 40

	const isOverElement = (clientX: number, clientY: number) => {
		const s = api.getAppState()
		const { x, y } = viewportCoordsToSceneCoords({ clientX, clientY }, s)
		const hit = (els: Parameters<typeof getCommonBounds>[0], margin: number) => {
			if (!els.length) return false
			const [x1, y1, x2, y2] = getCommonBounds(els)
			return x >= x1 - margin && x <= x2 + margin && y >= y1 - margin && y <= y2 + margin
		}
		const elements = api.getSceneElements()
		const selected = elements.filter((el) => s.selectedElementIds[el.id])
		// bounding boxes, not exact shapes: dragging inside an unfilled shape keeps Excalidraw's behaviour
		return hit(selected, HANDLE_MARGIN / s.zoom.value) || elements.some((el) => hit([el], 0))
	}

	const onPointerDown = (e: PointerEvent) => {
		const target = e.target as HTMLElement
		if (e.button !== 0 || e.pointerType !== 'mouse' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
		if (!target.classList.contains('interactive')) return // only the canvas itself, not UI on top
		const s = api.getAppState()
		if (s.activeTool.type !== 'selection' || s.editingTextElement || s.editingGroupId) return
		if (isOverElement(e.clientX, e.clientY)) return

		e.stopPropagation()
		e.preventDefault()
		const start = { x: e.clientX, y: e.clientY, scrollX: s.scrollX, scrollY: s.scrollY }
		const zoom = s.zoom.value
		let moved = false
		const cursor = target.style.cursor
		const onMove = (ev: PointerEvent) => {
			const dx = ev.clientX - start.x
			const dy = ev.clientY - start.y
			if (!moved && Math.hypot(dx, dy) < 3) return
			if (!moved) target.style.cursor = 'grabbing'
			moved = true
			api.updateScene({
				appState: { scrollX: start.scrollX + dx / zoom, scrollY: start.scrollY + dy / zoom },
				captureUpdate: CaptureUpdateAction.NEVER,
			})
		}
		const onUp = () => {
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', onUp)
			target.style.cursor = cursor
			// a click (no drag) on empty canvas deselects, as Excalidraw would have
			if (!moved) {
				api.updateScene({
					appState: { selectedElementIds: {}, selectedGroupIds: {} },
					captureUpdate: CaptureUpdateAction.NEVER,
				})
			}
		}
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onUp)
	}

	root.addEventListener('pointerdown', onPointerDown, true)
	return () => root.removeEventListener('pointerdown', onPointerDown, true)
}

/** The canvas. Everything Excalidraw-specific stays in this file + sync/bindExcalidraw.ts. */
export function Board({
	board,
	boardId,
	identity,
}: {
	board: BoardDoc
	boardId: string
	identity: Identity
}) {
	const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
	const binding = useRef<Binding | null>(null)
	const root = useRef<HTMLDivElement>(null)
	const overlay = useRef<Overlay | null>(null)
	// where the sticky pad is portalled into Excalidraw's toolbar row
	const [stackHost] = useState(() => document.createElement('div'))
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
		if (api && root.current) return enableDragToPan(api, root.current)
	}, [api])

	// Keep the sticky pad right after the tool island; Excalidraw re-mounts that row now and then.
	useEffect(() => {
		if (!api || !root.current) return
		const container = root.current
		const attach = () => {
			if (stackHost.isConnected) return
			const toolbar = container.querySelector('.App-toolbar-container > .App-toolbar')
			// insertBefore, not .after(): the Worker types' HTMLRewriter Element shadows the DOM signature
			toolbar?.parentNode?.insertBefore(stackHost, toolbar.nextSibling)
		}
		const unsubscribe = api.onChange(attach)
		const frame = requestAnimationFrame(attach)
		return () => {
			unsubscribe()
			cancelAnimationFrame(frame)
			stackHost.remove()
		}
	}, [api, stackHost])

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
			<style>{HIDDEN_TOOLS_CSS + BOTTOM_TOOLBAR_CSS}</style>
			<Excalidraw
				excalidrawAPI={setApi}
				isCollaborating
				initialData={{ appState: DEFAULT_APP_STATE }}
				UIOptions={UI_OPTIONS}
				onChange={(elements, appState, files) => binding.current?.onChange(elements, appState, files)}
				onPointerUpdate={(p) => binding.current?.onPointerUpdate(p)}
			>
				<MainMenu>
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.Item onSelect={() => setShowAuthors((v) => !v)}>
						{showAuthors ? 'Hide names on stickies' : 'Show names on stickies'}
					</MainMenu.Item>
					<MainMenu.DefaultItems.ChangeCanvasBackground />
					<MainMenu.DefaultItems.Help />
				</MainMenu>
			</Excalidraw>
			{createPortal(<StickyStack onClick={newSticky} />, stackHost)}
		</div>
	)
}
