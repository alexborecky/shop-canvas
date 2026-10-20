import { useEffect, useState } from 'react'
import YProvider from 'y-partyserver/provider'
import * as Y from 'yjs'
import { PARTY } from '../../shared/boardSchema'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface BoardDoc {
	doc: Y.Doc
	provider: YProvider
}

/**
 * Opens the shared Yjs document for a board and keeps a websocket to its Durable Object.
 * Returns null until the first sync with the server has finished, so callers never render
 * an empty board that then "pops in".
 */
export function useBoardDoc(boardId: string) {
	const [board, setBoard] = useState<BoardDoc | null>(null)
	const [status, setStatus] = useState<ConnectionStatus>('connecting')

	useEffect(() => {
		const doc = new Y.Doc()
		const provider = new YProvider(window.location.host, boardId, doc, { party: PARTY })

		const onStatus = ({ status }: { status: ConnectionStatus }) => setStatus(status)
		const onSync = (synced: boolean) => {
			if (synced) setBoard({ doc, provider })
		}
		provider.on('status', onStatus)
		provider.on('sync', onSync)

		return () => {
			provider.off('status', onStatus)
			provider.off('sync', onSync)
			provider.destroy()
			doc.destroy()
			setBoard(null)
		}
	}, [boardId])

	return { board, status }
}
