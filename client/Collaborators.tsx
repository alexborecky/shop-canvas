import { useSyncExternalStore } from 'react'
import type YProvider from 'y-partyserver/provider'
import type { Identity } from './identity'

const MAX_SHOWN = 5

/** Everyone else on the board right now (from Yjs awareness), one entry per person, not per tab. */
function useCollaborators(provider: YProvider) {
	const awareness = provider.awareness
	const snapshot = useSyncExternalStore(
		(cb) => {
			awareness.on('change', cb)
			return () => awareness.off('change', cb)
		},
		() => {
			const seen = new Set<string>()
			const users: Identity[] = []
			awareness.getStates().forEach((state, clientId) => {
				const user = (state as { user?: Identity }).user
				if (clientId === awareness.clientID || !user) return
				// the same person in two tabs shares name + colour (both come from localStorage)
				const key = `${user.name}|${user.color.stroke}`
				if (seen.has(key)) return
				seen.add(key)
				users.push(user)
			})
			// useSyncExternalStore needs a stable value while nothing changed
			return JSON.stringify(users)
		}
	)
	return JSON.parse(snapshot) as Identity[]
}

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (!parts.length) return '?'
	return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Avatars of the other people on the board, for the header. */
export function Collaborators({ provider }: { provider: YProvider }) {
	const users = useCollaborators(provider)
	if (!users.length) return null
	const shown = users.slice(0, MAX_SHOWN)
	const rest = users.slice(MAX_SHOWN)
	return (
		<div className="Collaborators" aria-label={`${users.length} other ${users.length === 1 ? 'person' : 'people'} on this board`}>
			{shown.map((u, i) => (
				<span key={i} className="Collaborators-avatar" style={{ background: u.color.stroke }} title={u.name || 'Anonymous'}>
					{initials(u.name)}
				</span>
			))}
			{rest.length > 0 && (
				<span className="Collaborators-avatar Collaborators-more" title={rest.map((u) => u.name || 'Anonymous').join(', ')}>
					+{rest.length}
				</span>
			)}
		</div>
	)
}
