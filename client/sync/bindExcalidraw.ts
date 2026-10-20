import { CaptureUpdateAction, getSceneVersion, reconcileElements } from '@excalidraw/excalidraw'
import type {
	ExcalidrawElement,
	FileId,
	OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import type {
	AppState,
	BinaryFileData,
	BinaryFiles,
	Collaborator,
	DataURL,
	ExcalidrawImperativeAPI,
	SocketId,
} from '@excalidraw/excalidraw/types'
import * as Y from 'yjs'
import { ELEMENTS_KEY, FILES_KEY, FileMeta, META_KEY } from '../../shared/boardSchema'
import type { Identity } from '../identity'
import type { BoardDoc } from './useBoardDoc'

/** Marks Yjs transactions we made ourselves, so we don't echo them back into Excalidraw. */
const LOCAL = Symbol('local-excalidraw')

interface Presence {
	user?: Identity
	pointer?: { x: number; y: number; tool: 'pointer' | 'laser' }
	button?: 'up' | 'down'
	selectedElementIds?: AppState['selectedElementIds']
}

/**
 * Two-way binding between one Excalidraw instance and a board's Yjs document.
 *
 * - Local edits:  Excalidraw onChange -> write changed elements (by `version`) into Y.Map
 * - Remote edits: Y.Map observer -> reconcileElements() -> excalidrawAPI.updateScene()
 * - Background:   appState.viewBackgroundColor <-> Y.Map 'meta' 'background'
 * - Images:       bytes uploaded to R2 once, Y.Map 'files' records that they exist;
 *                 other clients download missing ones and addFiles()
 * - Presence:     Yjs awareness carries name/colour/pointer/selection -> Excalidraw collaborators
 *
 * Returns handlers to wire into <Excalidraw> props, plus a dispose().
 */
export function bindExcalidraw(
	api: ExcalidrawImperativeAPI,
	{ doc, provider }: BoardDoc,
	boardId: string,
	identity: Identity
) {
	const yElements = doc.getMap<ExcalidrawElement>(ELEMENTS_KEY)
	const yFiles = doc.getMap<FileMeta>(FILES_KEY)
	const yMeta = doc.getMap<string>(META_KEY)
	const awareness = provider.awareness

	let lastSyncedVersion = -1
	// Excalidraw applies its own initialData after mount, wiping whatever we loaded before that.
	// So the real initial load happens on its first onChange.
	let initialised = false
	const uploading = new Set<string>()
	const downloading = new Set<string>()
	// background colour last seen in the doc / applied to Excalidraw; a difference in onChange
	// means the user picked a new one
	let lastBackground: string | undefined

	// ---------- remote -> local ----------

	const applyRemote = () => {
		// Clone: Excalidraw mutates scene elements in place, which must never touch Yjs' copies.
		const remote = Array.from(yElements.values(), (el) => structuredClone(el)) as RemoteExcalidrawElement[]
		const reconciled = reconcileElements(
			api.getSceneElementsIncludingDeleted(),
			remote,
			api.getAppState()
		)
		lastSyncedVersion = getSceneVersion(reconciled)
		api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER })
		void fetchMissingFiles()
	}

	const onElementsChanged = (_e: Y.YMapEvent<ExcalidrawElement>, tx: Y.Transaction) => {
		if (tx.origin !== LOCAL) applyRemote()
	}
	const onFilesChanged = (_e: Y.YMapEvent<FileMeta>, tx: Y.Transaction) => {
		if (tx.origin !== LOCAL) void fetchMissingFiles()
	}
	const applyBackground = () => {
		const background = yMeta.get('background')
		lastBackground = background ?? api.getAppState().viewBackgroundColor
		if (background && background !== api.getAppState().viewBackgroundColor) {
			api.updateScene({ appState: { viewBackgroundColor: background }, captureUpdate: CaptureUpdateAction.NEVER })
		}
	}
	const onMetaChanged = (e: Y.YMapEvent<string>, tx: Y.Transaction) => {
		if (tx.origin !== LOCAL && e.keysChanged.has('background')) applyBackground()
	}
	yElements.observe(onElementsChanged)
	yFiles.observe(onFilesChanged)
	yMeta.observe(onMetaChanged)

	async function fetchMissingFiles() {
		const have = api.getFiles()
		const missing = [...yFiles.keys()].filter((id) => !have[id] && !downloading.has(id))
		if (missing.length === 0) return

		const loaded: BinaryFileData[] = []
		await Promise.all(
			missing.map(async (id) => {
				downloading.add(id)
				try {
					const res = await fetch(`/api/files/${boardId}/${id}`)
					if (!res.ok) return
					const blob = await res.blob()
					loaded.push({
						id: id as FileId,
						mimeType: (yFiles.get(id)?.mimeType ?? blob.type) as BinaryFileData['mimeType'],
						dataURL: (await blobToDataURL(blob)) as DataURL,
						created: yFiles.get(id)?.created ?? Date.now(),
					})
				} finally {
					downloading.delete(id)
				}
			})
		)
		if (loaded.length) api.addFiles(loaded)
	}

	// ---------- local -> remote ----------

	const onChange = (
		elements: readonly OrderedExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles
	) => {
		if (!initialised) {
			initialised = true
			applyRemote()
			applyBackground()
			return
		}
		if (appState.viewBackgroundColor !== lastBackground) {
			lastBackground = appState.viewBackgroundColor
			doc.transact(() => yMeta.set('background', appState.viewBackgroundColor), LOCAL)
		}
		const version = getSceneVersion(elements)
		if (version !== lastSyncedVersion) {
			lastSyncedVersion = version
			doc.transact(() => {
				for (const el of elements) {
					const prev = yElements.get(el.id)
					// Excalidraw's conflict rule: higher version wins; on a tie, lower versionNonce wins.
					// Never overwrite a newer remote copy with an older local one.
					if (
						!prev ||
						el.version > prev.version ||
						(el.version === prev.version && el.versionNonce < prev.versionNonce)
					) {
						// store a snapshot, not Excalidraw's live (mutable) object
						yElements.set(el.id, structuredClone(el))
					}
				}
			}, LOCAL)
		}

		for (const file of Object.values(files)) void uploadFile(file)

		const selected = appState.selectedElementIds
		const current = (awareness.getLocalState() as Presence | null)?.selectedElementIds
		if (JSON.stringify(current) !== JSON.stringify(selected)) {
			awareness.setLocalStateField('selectedElementIds', selected)
		}
	}

	async function uploadFile(file: BinaryFileData) {
		if (yFiles.has(file.id) || uploading.has(file.id)) return
		uploading.add(file.id)
		try {
			const blob = await (await fetch(file.dataURL)).blob()
			const res = await fetch(`/api/files/${boardId}/${file.id}`, {
				method: 'POST',
				headers: { 'content-type': file.mimeType },
				body: blob,
			})
			if (!res.ok) {
				console.error('Image upload failed', res.status, await res.text())
				return
			}
			doc.transact(() => {
				yFiles.set(file.id, { mimeType: file.mimeType, created: file.created })
			}, LOCAL)
		} finally {
			uploading.delete(file.id)
		}
	}

	// ---------- presence ----------

	awareness.setLocalStateField('user', identity)

	let lastPointerSent = 0
	const onPointerUpdate = (payload: {
		pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
		button: 'up' | 'down'
	}) => {
		const now = performance.now()
		if (now - lastPointerSent < 40) return // ~25 fps is plenty for cursors
		lastPointerSent = now
		awareness.setLocalState({
			...(awareness.getLocalState() ?? {}),
			pointer: payload.pointer,
			button: payload.button,
		})
	}

	const onAwarenessChange = () => {
		const collaborators = new Map<SocketId, Collaborator>()
		awareness.getStates().forEach((state, clientId) => {
			if (clientId === awareness.clientID) return
			const p = state as Presence
			if (!p.user) return
			const id = String(clientId) as SocketId
			collaborators.set(id, {
				id,
				socketId: id,
				username: p.user.name || 'Anonymous',
				color: p.user.color,
				pointer: p.pointer,
				button: p.button,
				selectedElementIds: p.selectedElementIds,
			})
		})
		api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER })
	}
	awareness.on('change', onAwarenessChange)

	const setIdentity = (next: Identity) => awareness.setLocalStateField('user', next)

	// initial load
	applyRemote()
	onAwarenessChange()

	return {
		onChange,
		onPointerUpdate,
		setIdentity,
		dispose() {
			yElements.unobserve(onElementsChanged)
			yFiles.unobserve(onFilesChanged)
			yMeta.unobserve(onMetaChanged)
			awareness.off('change', onAwarenessChange)
		},
	}
}

function blobToDataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(blob)
	})
}
