declare global {
	interface Window {
		EXCALIDRAW_ASSET_PATH?: string
	}
}

// Excalidraw fetches fonts from `${EXCALIDRAW_ASSET_PATH}fonts/...`.
window.EXCALIDRAW_ASSET_PATH = '/'

export {}
