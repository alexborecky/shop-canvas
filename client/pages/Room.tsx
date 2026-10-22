import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Board } from '../Board'
import { BoardName } from '../BoardName'
import { Collaborators } from '../Collaborators'
import { getIdentity, Identity, setIdentityName } from '../identity'
import { MyAvatar } from '../MyAvatar'
import { NamePrompt } from '../NamePrompt'
import { rememberBoard } from '../recentBoards'
import { ConnectionStatus, useBoardDoc } from '../sync/useBoardDoc'
import { TimerPanel } from '../timer/TimerPanel'

export function Room() {
	const { roomId = '' } = useParams<{ roomId: string }>()
	const { board, status } = useBoardDoc(roomId)
	const [identity, setIdentity] = useState<Identity>(getIdentity)
	// no name yet: the board stays covered until you give one
	const [askName, setAskName] = useState(() => !identity.name)

	useEffect(() => {
		if (roomId) rememberBoard(roomId)
	}, [roomId])

	return (
		<div className="RoomWrapper">
			{/* inert: no clicks, focus or Tab into the board while the name modal is up */}
			<div className="RoomWrapper-content" inert={askName}>
				{board ? (
					<Board
						board={board}
						boardId={roomId}
						identity={identity}
						menuBar={
							<>
								<StatusDot status={status} />
								<BoardName doc={board.doc} roomId={roomId} />
							</>
						}
						toolbar={
							<>
								<TimerPanel doc={board.doc} />
								<Collaborators provider={board.provider} />
								<MyAvatar identity={identity} onRename={(name) => setIdentity(setIdentityName(name))} />
								<CopyLinkButton />
							</>
						}
					/>
				) : (
					<div className="Loading">Connecting…</div>
				)}
			</div>
			{askName && (
				<NamePrompt
					onSave={(name) => {
						setIdentity(setIdentityName(name))
						setAskName(false)
					}}
				/>
			)}
		</div>
	)
}

function StatusDot({ status }: { status: ConnectionStatus }) {
	const label = { connecting: 'Connecting…', connected: 'Live', disconnected: 'Offline — reconnecting' }[status]
	return <span className={`StatusDot StatusDot--${status}`} title={label} aria-label={label} />
}

function CopyLinkButton() {
	const [didCopy, setDidCopy] = useState(false)
	useEffect(() => {
		if (!didCopy) return
		const t = setTimeout(() => setDidCopy(false), 2000)
		return () => clearTimeout(t)
	}, [didCopy])
	return (
		<button
			className="RoomWrapper-copy"
			onClick={() => {
				navigator.clipboard.writeText(window.location.origin + window.location.pathname)
				setDidCopy(true)
			}}
		>
			{didCopy ? 'Copied!' : 'Copy link'}
		</button>
	)
}
