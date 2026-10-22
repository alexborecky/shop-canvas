/** The "time's up" sound, synthesised with the Web Audio API (no audio file). */

let ctx: AudioContext | null = null

// Browsers only allow audio after the user has interacted with the page,
// so the context is created/resumed on the first click or key press.
function unlock() {
	try {
		ctx ??= new AudioContext()
		if (ctx.state === 'suspended') void ctx.resume()
	} catch {
		// no Web Audio: the timer still shows "Time's up"
	}
}
window.addEventListener('pointerdown', unlock, { capture: true })
window.addEventListener('keydown', unlock, { capture: true })

/** Two soft sine notes, ~0.8 s. Silent if the page hasn't been interacted with yet. */
export function playChime() {
	if (!ctx || ctx.state !== 'running') return
	const start = ctx.currentTime
	const notes = [
		{ freq: 880, at: 0 },
		{ freq: 1320, at: 0.18 },
	]
	for (const { freq, at } of notes) {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.type = 'sine'
		osc.frequency.value = freq
		gain.gain.setValueAtTime(0, start + at)
		gain.gain.linearRampToValueAtTime(0.25, start + at + 0.01)
		gain.gain.exponentialRampToValueAtTime(0.001, start + at + 0.6)
		osc.connect(gain).connect(ctx.destination)
		osc.start(start + at)
		osc.stop(start + at + 0.65)
	}
}
