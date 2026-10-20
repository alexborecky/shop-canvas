import { Excalidraw, MainMenu } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_APP_STATE, HIDDEN_TOOLS, UI_OPTIONS } from './boardConfig'
import type { Identity } from './identity'
import { addSticky } from './stickies'
import { bindExcalidraw } from './sync/bindExcalidraw'
import type { BoardDoc } from './sync/useBoardDoc'

type Binding = ReturnType<typeof bindExcalidraw>

const HIDDEN_TOOLS_CSS =
	[
		...HIDDEN_TOOLS.map((t) => `.Board label:has(> [data-testid="toolbar-${t}"])`),
		'.Board label.ToolIcon__lock', // "keep tool active" toggle
		'.Board .App-toolbar__extra-tools-trigger', // "more tools" (frames, embeds, AI, mermaid...)
		'.Board .default-sidebar-trigger', // library sidebar
	].join(',\n') + ' { display: none !important; }'

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

	// "N" adds a sticky, like Miro/tldraw. Ignored while typing.
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (!api || e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
		const target = e.target as HTMLElement
		if (target.closest('input, textarea, [contenteditable="true"]')) return
		if (api.getAppState().editingTextElement) return
		e.preventDefault()
		addSticky(api)
	}

	return (
		<div className="Board" onKeyDown={onKeyDown}>
			<style>{HIDDEN_TOOLS_CSS}</style>
			<Excalidraw
				excalidrawAPI={setApi}
				isCollaborating
				initialData={{ appState: DEFAULT_APP_STATE }}
				UIOptions={UI_OPTIONS}
				onChange={(elements, appState, files) => binding.current?.onChange(elements, appState, files)}
				onPointerUpdate={(p) => binding.current?.onPointerUpdate(p)}
				renderTopRightUI={() =>
					api ? (
						<button className="StickyButton" onClick={() => addSticky(api)} title="Add sticky (N)">
							+ Sticky
						</button>
					) : null
				}
			>
				<MainMenu>
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.DefaultItems.ChangeCanvasBackground />
					<MainMenu.DefaultItems.Help />
				</MainMenu>
			</Excalidraw>
		</div>
	)
}
