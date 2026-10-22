import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import { TIMER_KEY, type TimerFields, type TimerStatus } from '../../shared/boardSchema'
import { isServerClockSynced, serverNow } from '../sync/serverClock'
import { playChime } from './chime'

const SECOND = 1000
const MINUTE = 60 * SECOND
const TICK_MS = 250
/** how long "Time's up" shows before everyone is back in setup */
const TIMES_UP_MS = 3 * SECOND

export const MIN_DURATION_MS = SECOND
export const MAX_DURATION_MS = 60 * MINUTE
export const DEFAULT_DURATION_MS = 5 * MINUTE

/** Below this, −/+ step by a minute; from here up, by 5 minutes. */
const COARSE_FROM_MS = 10 * MINUTE
const COARSE_STEP_MS = 5 * MINUTE

export const clampDuration = (ms: number) => Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms)))

/**
 * The −/+ step rule: 1 minute below 10:00 (seconds kept), multiples of 5 minutes from 10:00 up
 * (seconds reset). 9:30 + → 10:00, 12:00 + → 15:00, 15:00 − → 10:00, 10:00 − → 9:00.
 */
export function stepDuration(ms: number, dir: 1 | -1) {
	if (dir === 1) {
		const next = ms < COARSE_FROM_MS ? Math.min(ms + MINUTE, COARSE_FROM_MS) : (Math.floor(ms / COARSE_STEP_MS) + 1) * COARSE_STEP_MS
		return clampDuration(next)
	}
	const next = ms > COARSE_FROM_MS ? (Math.ceil(ms / COARSE_STEP_MS) - 1) * COARSE_STEP_MS : ms - MINUTE
	return clampDuration(next)
}

export const canStep = (ms: number, dir: 1 | -1) => (dir === 1 ? ms < MAX_DURATION_MS : ms > MIN_DURATION_MS)

/** whole minutes and seconds, rounded up so it shows 00:00 only at the very end */
export function splitMs(ms: number) {
	const total = Math.ceil(ms / SECOND)
	return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatMmSs(ms: number) {
	const { minutes, seconds } = splitMs(ms)
	return `${pad2(minutes)}:${pad2(seconds)}`
}

const STATUSES: TimerStatus[] = ['idle', 'running', 'paused']
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The timer map as a valid state. Missing map (older boards) or anything inconsistent reads as idle. */
export function readTimer(map: Y.Map<unknown>): TimerFields {
	const durationMs = clampDuration(num(map.get('durationMs')) ?? DEFAULT_DURATION_MS)
	const idle: TimerFields = { status: 'idle', durationMs, endsAt: null, remainingMs: null, updatedAt: num(map.get('updatedAt')) ?? 0 }
	const status = map.get('status') as TimerStatus
	const endsAt = num(map.get('endsAt'))
	const remainingMs = num(map.get('remainingMs'))
	if (!STATUSES.includes(status)) return idle
	if (status === 'running' && endsAt !== null) return { ...idle, status, endsAt }
	if (status === 'paused' && remainingMs !== null) return { ...idle, status, remainingMs }
	return idle
}

/** Always writes every field (see shared/boardSchema.ts for why). */
function writeTimer(map: Y.Map<unknown>, t: TimerFields) {
	for (const [key, value] of Object.entries(t)) map.set(key, value)
}

export type TimerPhase = 'setup' | 'running' | 'paused' | 'timesUp'

/**
 * The board's shared countdown: state from the doc + a locally ticking remaining time.
 * The doc is written only on actions (one transaction each), plus one guarded write back to
 * idle once "Time's up" has been shown.
 */
export function useBoardTimer(doc: Y.Doc) {
	const map = doc.getMap<unknown>(TIMER_KEY)
	const snapshot = useSyncExternalStore(
		(cb) => {
			map.observe(cb)
			return () => map.unobserve(cb)
		},
		// a string, so the snapshot stays stable while nothing changed
		() => JSON.stringify(readTimer(map)),
	)
	const timer = useMemo(() => JSON.parse(snapshot) as TimerFields, [snapshot])
	const [now, setNow] = useState(serverNow)
	const running = timer.status === 'running'
	const msPastEnd = running ? now - timer.endsAt! : -Infinity
	const phase: TimerPhase =
		timer.status === 'paused'
			? 'paused'
			: running && msPastEnd < 0
				? 'running'
				: running && msPastEnd < TIMES_UP_MS
					? 'timesUp'
					: 'setup' // idle, or past "Time's up" before the idle write arrives

	// Recompute from endsAt rather than counting ticks: background tabs throttle timers.
	useEffect(() => {
		setNow(serverNow())
		if (!running) return
		const update = () => setNow(serverNow())
		const interval = setInterval(update, TICK_MS)
		document.addEventListener('visibilitychange', update)
		return () => {
			clearInterval(interval)
			document.removeEventListener('visibilitychange', update)
		}
	}, [running, timer])

	// Chime only for a run this tab saw counting down: late joiners and reloads after zero stay quiet.
	const armedFor = useRef<number | null>(null)
	const synced = isServerClockSynced()
	useEffect(() => {
		if (!synced || !running) return
		if (msPastEnd < 0) armedFor.current = timer.endsAt
		else if (armedFor.current === timer.endsAt) {
			armedFor.current = null
			playChime()
		}
	}, [synced, running, timer, msPastEnd])

	// After "Time's up", whoever notices first sets it back to idle. Guarded, so several clients
	// doing it is harmless, and a +1m or new start that landed meanwhile is never overwritten.
	const finished = running && msPastEnd >= TIMES_UP_MS
	useEffect(() => {
		if (!synced || !finished) return
		const endsAt = timer.endsAt!
		doc.transact(() => {
			const cur = readTimer(map)
			if (cur.status !== 'running' || cur.endsAt !== endsAt || serverNow() < endsAt + TIMES_UP_MS) return
			writeTimer(map, { ...cur, status: 'idle', endsAt: null, updatedAt: serverNow() })
		})
	}, [synced, finished, timer, doc, map])

	const actions = useMemo(() => {
		const update = (next: (cur: TimerFields, now: number) => TimerFields | null) =>
			doc.transact(() => {
				const now = serverNow()
				const t = next(readTimer(map), now)
				if (t) writeTimer(map, { ...t, updatedAt: now })
			})
		return {
			/** also remembers the duration as the board's last one */
			start: (durationMs: number) =>
				update((cur, now) => {
					const ms = clampDuration(durationMs)
					return { ...cur, status: 'running', durationMs: ms, endsAt: now + ms, remainingMs: null }
				}),
			pause: () =>
				update((cur, now) =>
					cur.status === 'running' && cur.endsAt! > now
						? { ...cur, status: 'paused', endsAt: null, remainingMs: cur.endsAt! - now }
						: null,
				),
			resume: () =>
				update((cur, now) =>
					cur.status === 'paused' ? { ...cur, status: 'running', endsAt: now + cur.remainingMs!, remainingMs: null } : null,
				),
			add: (ms: number) =>
				update((cur, now) => {
					if (cur.status === 'running' && cur.endsAt! > now) return { ...cur, endsAt: cur.endsAt! + ms }
					if (cur.status === 'paused') return { ...cur, remainingMs: cur.remainingMs! + ms }
					return null
				}),
			/** back to setup with the last duration */
			stop: () => update((cur) => ({ ...cur, status: 'idle', endsAt: null, remainingMs: null })),
		}
	}, [doc, map])

	const remainingMs = phase === 'paused' ? timer.remainingMs! : phase === 'running' ? timer.endsAt! - now : 0

	return { phase, durationMs: timer.durationMs, remainingMs, actions }
}
