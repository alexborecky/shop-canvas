import {
	AssetToolbarItem,
	DefaultToolbar,
	EraserToolbarItem,
	HandToolbarItem,
	NoteToolbarItem,
	RectangleToolbarItem,
	SelectToolbarItem,
	TextToolbarItem,
	TLComponents,
	TLUiOverrides,
} from 'tldraw'

/**
 * The tools a Shoptet Canvas board exposes.
 * Product scope: stickies, rectangles, text, images. Everything else is hidden.
 * To bring a tool back, add its id here AND its <XToolbarItem /> to the toolbar below.
 */
export const ALLOWED_TOOLS = new Set([
	'select',
	'hand',
	'note', // sticky
	'rectangle', // geo shape, rectangle variant
	'text',
	'asset', // image upload
	'eraser',
])

/** Stripped-down toolbar. Order here is the order users see. */
function BoardToolbar() {
	return (
		<DefaultToolbar>
			<SelectToolbarItem />
			<HandToolbarItem />
			<NoteToolbarItem />
			<RectangleToolbarItem />
			<TextToolbarItem />
			<AssetToolbarItem />
			<EraserToolbarItem />
		</DefaultToolbar>
	)
}

export const boardComponents: TLComponents = {
	Toolbar: BoardToolbar,
}

/**
 * Hidden tools still have keyboard shortcuts (d = draw, a = arrow, ...).
 * Strip the shortcut from anything not in ALLOWED_TOOLS so people can't
 * reach them by accident.
 */
export const boardOverrides: TLUiOverrides = {
	tools(_editor, tools) {
		for (const [id, tool] of Object.entries(tools)) {
			// geo variants (ellipse, triangle, ...) are separate tool ids, so this hides them too
			if (!ALLOWED_TOOLS.has(id)) {
				tools[id] = { ...tool, kbd: undefined }
			}
		}
		return tools
	},
}
