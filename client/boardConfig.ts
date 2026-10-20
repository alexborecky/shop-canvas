import { FONT_FAMILY } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawProps } from '@excalidraw/excalidraw/types'

/**
 * Product scope lives here: what the board can do and how it looks by default.
 * Scope: stickies, rectangles, text, images (+ select, hand, eraser).
 */

/** Toolbar buttons we hide (Excalidraw tool types). Hidden via CSS in index.css too. */
export const HIDDEN_TOOLS = ['diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'laser', 'frame', 'embeddable', 'magicframe']

export const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
	canvasActions: {
		changeViewBackgroundColor: true,
		toggleTheme: true,
		clearCanvas: false, // one click wipes everyone's board — no thanks
		export: false,
		loadScene: false,
		saveToActiveFile: false,
		saveAsImage: false,
	},
	tools: { image: true },
}

/** Clean, non-sketchy defaults so it reads as a work tool, not a doodle. */
export const DEFAULT_APP_STATE: Partial<AppState> = {
	currentItemRoughness: 0,
	currentItemFontFamily: FONT_FAMILY.Nunito,
	currentItemRoundness: 'round',
	currentItemStrokeWidth: 1,
	currentItemFontSize: 20,
}

export const STICKY = {
	size: 200,
	background: '#ffec99',
	stroke: '#f2c94c',
}
