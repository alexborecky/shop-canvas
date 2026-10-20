import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { STICKY } from './boardConfig'

/**
 * A sticky is a yellow, sharp-cornered rectangle with a drop shadow and its author's
 * name in the footer (see `mountStickyOverlay`); text goes inside as Excalidraw's bound label
 * (select it and press Enter, or double-click, to type). Tagged with customData so a future
 * canvas can recognise stickies as their own type.
 */
export function addSticky(api: ExcalidrawImperativeAPI, author: string) {
	const s = api.getAppState()
	const cx = -s.scrollX + s.width / 2 / s.zoom.value
	const cy = -s.scrollY + s.height / 2 / s.zoom.value
	// small jitter so repeated stickies don't stack exactly on top of each other
	const jitter = () => Math.round((Math.random() - 0.5) * 60)

	const [sticky] = convertToExcalidrawElements([
		{
			type: 'rectangle',
			x: cx - STICKY.size / 2 + jitter(),
			y: cy - STICKY.size / 2 + jitter(),
			width: STICKY.size,
			height: STICKY.size,
			backgroundColor: STICKY.background,
			strokeColor: STICKY.stroke,
			fillStyle: 'solid',
			strokeWidth: 1,
			roughness: 0,
			roundness: null,
			customData: author ? { kind: 'sticky', author } : { kind: 'sticky' },
		},
	])

	api.updateScene({
		elements: [...api.getSceneElementsIncludingDeleted(), sticky],
		appState: { selectedElementIds: { [sticky.id]: true } },
		captureUpdate: CaptureUpdateAction.IMMEDIATELY,
	})
}

const isSticky = (el: ExcalidrawElement) => !el.isDeleted && el.customData?.kind === 'sticky'

/** Cut `text` to fit `maxWidth` with an ellipsis, using the context's current font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
	if (ctx.measureText(text).width <= maxWidth) return text
	let lo = 0
	let hi = text.length
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2)
		if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid
		else hi = mid - 1
	}
	return lo ? text.slice(0, lo) + '…' : ''
}

/**
 * Excalidraw can't draw shadows, so we paint sticky extras on our own canvas slotted between
 * Excalidraw's static canvas (elements) and its interactive one (selection, cursors): the drop
 * shadow, with each sticky's own area punched out again, and the author's name in the footer
 * (not an element, so nobody can edit it). Purely visual — nothing goes into the doc.
 */
export function mountStickyOverlay(
	api: ExcalidrawImperativeAPI,
	root: HTMLElement,
	{ showAuthors }: { showAuthors: () => boolean },
) {
	const canvas = document.createElement('canvas')
	// filter: none opts out of Excalidraw's dark-mode invert, which would turn the shadow into a glow
	canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;filter:none'
	const ctx = canvas.getContext('2d')!
	let frame = 0

	const draw = () => {
		frame = 0
		const wrapper = root.querySelector('.excalidraw__canvas-wrapper')
		if (!wrapper) return
		if (canvas.parentElement !== wrapper) wrapper.appendChild(canvas)

		const s = api.getAppState()
		const dpr = window.devicePixelRatio || 1
		const zoom = s.zoom.value
		if (canvas.width !== Math.round(s.width * dpr) || canvas.height !== Math.round(s.height * dpr)) {
			canvas.width = Math.round(s.width * dpr)
			canvas.height = Math.round(s.height * dpr)
			canvas.style.width = `${s.width}px`
			canvas.style.height = `${s.height}px`
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		// shadow blur/offset are in device pixels and ignore the transform, so scale them by hand
		const px = zoom * dpr
		// skip names once they'd be too small to read
		const authors = showAuthors() && STICKY.authorFontSize * zoom >= 4
		ctx.font = `${STICKY.authorFontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
		ctx.textBaseline = 'bottom'
		const authorColor = s.theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.45)'

		for (const el of api.getSceneElements()) {
			if (!isSticky(el)) continue
			ctx.setTransform(px, 0, 0, px, (el.x + el.width / 2 + s.scrollX) * px, (el.y + el.height / 2 + s.scrollY) * px)
			ctx.rotate(el.angle)
			const w = el.width
			const h = el.height
			const r = el.roundness ? Math.min(32, Math.min(w, h) * 0.25) : 0
			// in z-order: punching out this sticky also removes lower stickies' shadows and names it covers.
			// Opaque fill matters: destination-out only removes as much as the fill's alpha, and the
			// author text below leaves a translucent fillStyle behind.
			ctx.fillStyle = '#000'
			ctx.globalCompositeOperation = 'source-over'
			for (const sh of STICKY.shadows) {
				// a narrower block in the lower part of the sticky, so its shadow mostly shows underneath
				ctx.shadowColor = `rgba(0, 0, 0, ${sh.alpha})`
				ctx.shadowBlur = sh.blur * px
				ctx.shadowOffsetY = sh.offset * px
				ctx.beginPath()
				ctx.roundRect(-w / 2 + sh.inset, h / 2 - h * sh.height, w - sh.inset * 2, h * sh.height, r)
				ctx.fill()
			}
			// punch out a device pixel wider than the sticky, or the anti-aliased edge of the black fill
			// survives as a dark hairline that reads like a stroke
			const grow = 1 / px
			ctx.globalCompositeOperation = 'destination-out'
			ctx.shadowColor = 'transparent'
			ctx.beginPath()
			ctx.roundRect(-w / 2 - grow, -h / 2 - grow, w + grow * 2, h + grow * 2, r)
			ctx.fill()
			ctx.globalCompositeOperation = 'source-over'

			const author = el.customData?.author
			if (authors && typeof author === 'string' && author) {
				const pad = STICKY.authorPadding
				ctx.fillStyle = authorColor
				ctx.fillText(fitText(ctx, author, el.width - pad * 2), -el.width / 2 + pad, el.height / 2 - pad)
			}
		}
	}

	const redraw = () => {
		if (!frame) frame = requestAnimationFrame(draw)
	}
	const unsubscribe = api.onChange(redraw)
	redraw()

	return {
		redraw,
		dispose() {
			unsubscribe()
			cancelAnimationFrame(frame)
			canvas.remove()
		},
	}
}
