// Must run before Excalidraw loads: serve its fonts from our own origin (public/fonts),
// copied there by scripts/copy-excalidraw-assets.mjs. No third-party CDN at runtime.
import './excalidrawAssets'

import '@excalidraw/excalidraw/index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useParams } from 'react-router-dom'
import './index.css'
import { Room } from './pages/Room'
import { Root } from './pages/Root'

// remount the whole room when switching boards, so no state leaks between them
function KeyedRoom() {
	const { roomId } = useParams()
	return <Room key={roomId} />
}

const router = createBrowserRouter([
	{ path: '/', element: <Root /> },
	{ path: '/b/:roomId', element: <KeyedRoom /> },
])

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
)
