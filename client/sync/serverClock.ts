/**
 * The server's clock, estimated from `GET /api/time`. Shared timers use `serverNow()` instead of
 * `Date.now()` so machines with wrong clocks still agree on when a countdown ends.
 */

const SAMPLES = 3

/** Dev only: `?skew=30` pretends this machine's clock is 30 s fast, to test the offset estimate. */
const devSkewMs = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('skew') ?? 0) * 1000 || 0 : 0

const localNow = () => Date.now() + devSkewMs

let offset = 0
let synced = false
let syncing: Promise<void> | null = null

export function serverNow() {
	return localNow() + offset
}

/** False until the first estimate: decisions like "has the timer ended?" should wait for it. */
export function isServerClockSynced() {
	return synced
}

async function sample() {
	const t0 = localNow()
	const res = await fetch('/api/time', { cache: 'no-store' })
	const { now } = (await res.json()) as { now: number }
	const t1 = localNow()
	// assume the server read its clock halfway through the round trip
	return { rtt: t1 - t0, offset: now - (t0 + (t1 - t0) / 2) }
}

/** Re-estimate the offset; the sample with the shortest round trip is the most accurate. */
export function syncServerClock() {
	syncing ??= (async () => {
		try {
			let best: Awaited<ReturnType<typeof sample>> | null = null
			for (let i = 0; i < SAMPLES; i++) {
				const s = await sample()
				if (!best || s.rtt < best.rtt) best = s
			}
			if (best) {
				offset = best.offset
				synced = true
			}
		} catch (error) {
			console.warn('Failed to sync with server clock:', error)
		} finally {
			syncing = null
		}
	})()
	return syncing
}

// a laptop waking from sleep may have drifted
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') void syncServerClock()
})
