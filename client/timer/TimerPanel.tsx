import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import {
	canStep,
	clampDuration,
	formatMmSs,
	pad2,
	splitMs,
	stepDuration,
	type TimerPhase,
	useBoardTimer,
} from './useBoardTimer'

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true } as const

const TimerIcon = () => (
	<svg {...icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<circle cx="12" cy="13" r="8" />
		<path d="M12 9v4l2.5 2.5M9 2h6" />
	</svg>
)
const PlayIcon = () => (
	<svg {...icon} fill="currentColor">
		<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
	</svg>
)
const PauseIcon = () => (
	<svg {...icon} fill="currentColor">
		<rect x="6" y="5" width="4" height="14" rx="1" />
		<rect x="14" y="5" width="4" height="14" rx="1" />
	</svg>
)
const StopIcon = () => (
	<svg {...icon} fill="currentColor">
		<rect x="6" y="6" width="12" height="12" rx="2" />
	</svg>
)

/**
 * Shared countdown, Miro-style: a toolbar button plus a panel floating over the top-right of the
 * board. Whether the panel is shown is local; a new start shows it to everyone.
 */
export function TimerPanel({ doc }: { doc: Y.Doc }) {
	const { phase, durationMs, remainingMs, actions } = useBoardTimer(doc)
	const [open, setOpen] = useState(false)
	// opened by someone's start rather than by me: closes again when the timer is over
	const autoOpened = useRef(false)
	const prevPhase = useRef<TimerPhase>('setup')
	const openRef = useRef(open)
	openRef.current = open

	useEffect(() => {
		const prev = prevPhase.current
		prevPhase.current = phase
		if (prev === 'setup' && phase !== 'setup') {
			if (!openRef.current) autoOpened.current = true
			setOpen(true)
		} else if (prev !== 'setup' && phase === 'setup' && autoOpened.current) {
			autoOpened.current = false
			setOpen(false)
		}
	}, [phase])

	return (
		<>
			<button
				className={`TimerButton ${open ? 'TimerButton--open' : ''}`}
				title="Timer"
				aria-label="Timer"
				aria-pressed={open}
				onClick={() => {
					autoOpened.current = false
					setOpen((v) => !v)
				}}
			>
				<TimerIcon />
			</button>
			{open && (
				<div
					className={`TimerPanel ${phase === 'setup' ? '' : 'TimerPanel--active'}`}
					role="dialog"
					aria-label="Timer"
					onKeyDown={(e) => e.stopPropagation()} // keep Excalidraw shortcuts out of the inputs
				>
					{phase === 'setup' ? (
						<TimerSetup durationMs={durationMs} onStart={actions.start} />
					) : (
						<TimerRunning phase={phase} remainingMs={remainingMs} actions={actions} />
					)}
					<button
						className="TimerPanel-close"
						aria-label="Close timer"
						onClick={() => {
							autoOpened.current = false
							setOpen(false)
						}}
					>
						×
					</button>
				</div>
			)}
		</>
	)
}

function TimerSetup({ durationMs, onStart }: { durationMs: number; onStart: (ms: number) => void }) {
	// local until Play; starts from (and follows) the board's last duration
	const [ms, setMs] = useState(durationMs)
	useEffect(() => setMs(durationMs), [durationMs])
	const { minutes, seconds } = splitMs(ms)
	const withMinutes = (m: number) => clampDuration((m * 60 + seconds) * 1000)
	const withSeconds = (s: number) => clampDuration((minutes * 60 + Math.min(59, Math.max(0, s))) * 1000)

	return (
		<div className="TimerPanel-body">
			<div className="TimerPanel-setup">
				<button className="TimerPanel-step" aria-label="Less time" disabled={!canStep(ms, -1)} onClick={() => setMs(stepDuration(ms, -1))}>
					−
				</button>
				<div className="TimerPanel-time">
					<DigitInput
						label="Minutes"
						value={minutes}
						onCommit={(m) => setMs(withMinutes(m))}
						onStart={(m) => onStart(withMinutes(m))}
					/>
					<span className="TimerPanel-colon">:</span>
					<DigitInput
						label="Seconds"
						value={seconds}
						onCommit={(s) => setMs(withSeconds(s))}
						onStart={(s) => onStart(withSeconds(s))}
					/>
				</div>
				<button className="TimerPanel-step" aria-label="More time" disabled={!canStep(ms, 1)} onClick={() => setMs(stepDuration(ms, 1))}>
					+
				</button>
			</div>
			<div className="TimerPanel-divider" />
			<button className="TimerPanel-primary TimerPanel-play" aria-label="Start timer" onClick={() => onStart(ms)}>
				<PlayIcon />
			</button>
		</div>
	)
}

/** Two editable digits: type, ArrowUp/ArrowDown to step, Enter to start, Escape to leave. */
function DigitInput({
	label,
	value,
	onCommit,
	onStart,
}: {
	label: string
	value: number
	onCommit: (n: number) => void
	onStart: (n: number) => void
}) {
	// digits typed since focus; '' = untouched (shows the value). Handled per key, so the caret
	// position never matters: like a digital clock, new digits push in from the right.
	const [draft, setDraft] = useState('')
	const parsed = () => (draft === '' ? value : Number(draft))
	const push = (digits: string) => setDraft((d) => (d + digits).slice(-2))

	return (
		<input
			className="TimerPanel-digits"
			aria-label={label}
			inputMode="numeric"
			value={draft || pad2(value)}
			onFocus={(e) => {
				setDraft('')
				e.currentTarget.select()
			}}
			onChange={(e) => {
				// paste / mobile keyboards; typed digits are handled in onKeyDown
				setDraft(e.target.value.replace(/\D/g, '').slice(-2))
			}}
			onBlur={() => {
				onCommit(parsed())
				setDraft('')
			}}
			onKeyDown={(e) => {
				if (/^\d$/.test(e.key)) {
					e.preventDefault()
					push(e.key)
				} else if (e.key === 'Backspace') {
					e.preventDefault()
					setDraft((d) => d.slice(0, -1))
				} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
					e.preventDefault()
					onCommit(parsed() + (e.key === 'ArrowUp' ? 1 : -1))
					setDraft('') // show the clamped value from the parent
				} else if (e.key === 'Enter') {
					onStart(parsed())
					setDraft('')
				} else if (e.key === 'Escape') {
					e.currentTarget.blur()
				}
			}}
		/>
	)
}

function TimerRunning({
	phase,
	remainingMs,
	actions,
}: {
	phase: Exclude<TimerPhase, 'setup'>
	remainingMs: number
	actions: ReturnType<typeof useBoardTimer>['actions']
}) {
	if (phase === 'timesUp') {
		return (
			<div className="TimerPanel-body">
				<div className="TimerPanel-timesUp">Time's up</div>
			</div>
		)
	}
	return (
		<div className="TimerPanel-body">
			<div className="TimerPanel-countdown">
				<div className="TimerPanel-clock">{formatMmSs(remainingMs)}</div>
				<div className="TimerPanel-pills">
					<button className="TimerPanel-pill" onClick={() => actions.add(60_000)}>
						+1m
					</button>
					<button className="TimerPanel-pill" onClick={() => actions.add(5 * 60_000)}>
						+5m
					</button>
				</div>
			</div>
			<div className="TimerPanel-actions">
				<button className="TimerPanel-secondary" aria-label="Stop timer" title="Stop" onClick={actions.stop}>
					<StopIcon />
				</button>
				{phase === 'paused' ? (
					<button className="TimerPanel-primary" aria-label="Resume timer" title="Resume" onClick={actions.resume}>
						<PlayIcon />
					</button>
				) : (
					<button className="TimerPanel-primary" aria-label="Pause timer" title="Pause" onClick={actions.pause}>
						<PauseIcon />
					</button>
				)}
			</div>
		</div>
	)
}
