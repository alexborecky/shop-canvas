import { CaptureUpdateAction, convertToExcalidrawElements, ROUNDNESS } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { STICKY } from './boardConfig'

/**
 * A sticky is a yellow rectangle; text goes inside as Excalidraw's bound label
 * (select it and press Enter, or double-click, to type). Tagged with customData so a future
 * canvas can recognise stickies as their own type.
 */
export function addSticky(api: ExcalidrawImperativeAPI) {
	const s = api.getAppState()
	const cx = -s.scrollX + s.width / 2 / s.zoom.value
	const cy = -s.scrollY + s.height / 2 / s.zoom.value
	// small jitter so repeated stickies don't stack exactly on top of each other
	const jitter = () => Math.round((Math.random() - 0.5) * 60)

	const [sticky] = convertToExcalidrawElements([
		{
			type: 'rectangle',
			x: cx - STICKY.size / 2 + jitter(),
			y: cy - STICKY.size / 2 + jitter(),
			width: STICKY.size,
			height: STICKY.size,
			backgroundColor: STICKY.background,
			strokeColor: STICKY.stroke,
			fillStyle: 'solid',
			strokeWidth: 1,
			roughness: 0,
			roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
			customData: { kind: 'sticky' },
		},
	])

	api.updateScene({
		elements: [...api.getSceneElementsIncludingDeleted(), sticky],
		appState: { selectedElementIds: { [sticky.id]: true } },
		captureUpdate: CaptureUpdateAction.IMMEDIATELY,
	})
}
