import { FONT_FAMILY } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawProps } from '@excalidraw/excalidraw/types'

/**
 * Product scope lives here: what the board can do and how it looks by default.
 * Scope: stickies, shapes (rectangle, diamond, ellipse), arrows, lines, freehand, text, images
 * (+ select, hand, eraser).
 */

/** Toolbar buttons we hide (Excalidraw tool types). Hidden via CSS in index.css too. */
export const HIDDEN_TOOLS = ['laser', 'frame', 'embeddable', 'magicframe']

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
	stroke: 'transparent', // real sticky notes have no outline; the shadow does the edge
	/**
	 * Drop shadow, weighted towards the bottom edge like a note lifting off the wall. Each layer is
	 * cast by a block `inset` px narrower than the sticky, covering its lower `height` fraction;
	 * blur/offset in scene px.
	 */
	shadows: [
		{ inset: 0, height: 1, blur: 3, offset: 1, alpha: 0.12 }, // tight contact shadow all round
		{ inset: 10, height: 0.5, blur: 8, offset: 6, alpha: 0.22 }, // soft weight under the bottom
	],
	/** author name in the sticky's footer, in scene px */
	authorFontSize: 11,
	authorPadding: 10,
}
