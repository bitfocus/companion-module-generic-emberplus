import type { DropdownChoice } from '@companion-module/base'
import { Easing } from './easings.js'

/**
 * The easing curves a ramp can follow. Each moves steadily from 0 to 1, so a ramp never passes its target or turns
 * back toward its start: Elastic and Back overshoot both ends, and Bounce falls back several times, so they are left out
 */
const easings = {
	linear: (k) => Easing.Linear.None(k),
	'quadratic-in': (k) => Easing.Quadratic.In(k),
	'quadratic-out': (k) => Easing.Quadratic.Out(k),
	'quadratic-in-out': (k) => Easing.Quadratic.InOut(k),
	'cubic-in': (k) => Easing.Cubic.In(k),
	'cubic-out': (k) => Easing.Cubic.Out(k),
	'cubic-in-out': (k) => Easing.Cubic.InOut(k),
	'quartic-in': (k) => Easing.Quartic.In(k),
	'quartic-out': (k) => Easing.Quartic.Out(k),
	'quartic-in-out': (k) => Easing.Quartic.InOut(k),
	'quintic-in': (k) => Easing.Quintic.In(k),
	'quintic-out': (k) => Easing.Quintic.Out(k),
	'quintic-in-out': (k) => Easing.Quintic.InOut(k),
	'sinusoidal-in': (k) => Easing.Sinusoidal.In(k),
	'sinusoidal-out': (k) => Easing.Sinusoidal.Out(k),
	'sinusoidal-in-out': (k) => Easing.Sinusoidal.InOut(k),
	'exponential-in': (k) => Easing.Exponential.In(k),
	'exponential-out': (k) => Easing.Exponential.Out(k),
	'exponential-in-out': (k) => Easing.Exponential.InOut(k),
	'circular-in': (k) => Easing.Circular.In(k),
	'circular-out': (k) => Easing.Circular.Out(k),
	'circular-in-out': (k) => Easing.Circular.InOut(k),
} as const satisfies Record<string, (k: number) => number>

export type EasingId = keyof typeof easings

export const EasingChoices = [
	{ id: 'linear', label: 'Linear' },
	{ id: 'quadratic-in', label: 'Quadratic In' },
	{ id: 'quadratic-out', label: 'Quadratic Out' },
	{ id: 'quadratic-in-out', label: 'Quadratic In/Out' },
	{ id: 'cubic-in', label: 'Cubic In' },
	{ id: 'cubic-out', label: 'Cubic Out' },
	{ id: 'cubic-in-out', label: 'Cubic In/Out' },
	{ id: 'quartic-in', label: 'Quartic In' },
	{ id: 'quartic-out', label: 'Quartic Out' },
	{ id: 'quartic-in-out', label: 'Quartic In/Out' },
	{ id: 'quintic-in', label: 'Quintic In' },
	{ id: 'quintic-out', label: 'Quintic Out' },
	{ id: 'quintic-in-out', label: 'Quintic In/Out' },
	{ id: 'sinusoidal-in', label: 'Sinusoidal In' },
	{ id: 'sinusoidal-out', label: 'Sinusoidal Out' },
	{ id: 'sinusoidal-in-out', label: 'Sinusoidal In/Out' },
	{ id: 'exponential-in', label: 'Exponential In' },
	{ id: 'exponential-out', label: 'Exponential Out' },
	{ id: 'exponential-in-out', label: 'Exponential In/Out' },
	{ id: 'circular-in', label: 'Circular In' },
	{ id: 'circular-out', label: 'Circular Out' },
	{ id: 'circular-in-out', label: 'Circular In/Out' },
] as const satisfies DropdownChoice<EasingId>[]

/**
 * The curve for an easing option's value. A value this version doesn't offer (an expression, or a saved option from a
 * later version) ramps in a straight line rather than failing the action
 */
export function easingOf(id: unknown): (k: number) => number {
	return typeof id === 'string' && Object.hasOwn(easings, id) ? easings[id as EasingId] : easings.linear
}

/** The step interval for a connection whose config has none: one from before the setting */
export const rampIntervalDefault = 50

/** What a ramp does, in the parameter's displayed units (dB, Hz) */
export interface RampSpec {
	/** Where the ramp starts, as displayed */
	from: number
	/** Where it ends, as displayed */
	to: number
	/** The device value sent last, exactly: the target, after the action's limits and the parameter's range */
	target: number
	/** How long it takes, in ms. Up to one step interval, the target is set at once */
	duration: number
	/** How the ramp moves from start to target over its time: 0 to 1, for 0 to 1 */
	easing: (k: number) => number
	/** A displayed value as the device value to send, held to the parameter's range. May throw */
	toDevice: (displayed: number) => number
	/**
	 * Send a device value. The final step's promise settles with the provider's reply; a step before it is sent without
	 * waiting for one
	 */
	send: (value: number, final: boolean) => Promise<void>
}

/** How a ramp ended: reached its target, or stopped where it was (by a newer ramp, Stop Ramp, a Set Value, a reconnect) */
export type RampOutcome = 'done' | 'cancelled'

/** A ramp started: its end, and a way to stop this ramp alone, and not a newer one on the same path */
export interface RampHandle {
	/** Settles when the ramp ends: rejects if the final step fails */
	readonly done: Promise<RampOutcome>
	cancel(): void
}

interface Ramp {
	spec: RampSpec
	start: number
	/** The displayed value of the last step sent, or the start before any: where a ramp replacing this one starts */
	position: number
	/** The device value last sent, so that a step that rounds to the same value isn't sent again */
	lastSent: number | undefined
	resolve: (outcome: RampOutcome) => void
	reject: (error: unknown) => void
}

export interface RampEngineOptions {
	/** Milliseconds, for the time a ramp has run. Wrapped, as performance.now called unbound throws */
	clock?: () => number
	/** The step interval in ms */
	interval?: number
	/** Told of a step that failed to send; the ramp carries on */
	onStepError?: (path: string, error: unknown) => void
}

/**
 * Ramps parameters to values over a time by sending steps, one ramp per path. All of them step on one timer, running
 * only while there are ramps. Each step is worked out from the clock, not by counting ticks, so a late tick doesn't
 * stretch a ramp.
 */
export class RampEngine {
	readonly #clock: () => number
	readonly #onStepError: (path: string, error: unknown) => void
	readonly #ramps: Map<string, Ramp> = new Map()
	#interval: number
	#timer: NodeJS.Timeout | undefined

	constructor(options: RampEngineOptions = {}) {
		this.#clock = options.clock ?? (() => performance.now())
		this.#interval = validInterval(options.interval)
		this.#onStepError = options.onStepError ?? (() => undefined)
	}

	/** The step interval in ms */
	get interval(): number {
		return this.#interval
	}

	/** The engine's clock, in ms: for measuring how long an action has taken, on the same clock as the ramps */
	now(): number {
		return this.#clock()
	}

	/** Change the step interval; ramps running carry on at the new one */
	setStepInterval(interval: number | undefined): void {
		const next = validInterval(interval)
		if (next === this.#interval) return
		this.#interval = next
		if (this.#timer !== undefined) {
			clearInterval(this.#timer)
			this.#timer = setInterval(() => this.#tick(), this.#interval)
		}
	}

	/** Whether a ramp is running on a path */
	has(path: string): boolean {
		return this.#ramps.has(path)
	}

	/** Where a running ramp has reached, as displayed: the last step it sent, or its start. Undefined with none running */
	position(path: string): number | undefined {
		return this.#ramps.get(path)?.position
	}

	/**
	 * Start a ramp on a path, stopping any running there. A duration of one step interval or less sets the target at
	 * once, without a timer
	 */
	start(path: string, spec: RampSpec): RampHandle {
		this.cancel(path)
		const duration = Number.isFinite(spec.duration) && spec.duration > 0 ? spec.duration : 0

		if (duration <= this.#interval) {
			const done = sendStep(spec, spec.target, true).then((): RampOutcome => 'done')
			return { done, cancel: () => undefined }
		}

		const { promise, resolve, reject } = Promise.withResolvers<RampOutcome>()
		const ramp: Ramp = {
			spec: { ...spec, duration },
			start: this.#clock(),
			position: spec.from,
			lastSent: undefined,
			resolve,
			reject,
		}
		this.#ramps.set(path, ramp)
		this.#timer ??= setInterval(() => this.#tick(), this.#interval)
		return {
			done: promise,
			cancel: () => {
				if (this.#ramps.get(path) === ramp) this.cancel(path)
			},
		}
	}

	/** Stop the ramp on a path where it is. Returns whether one was running */
	cancel(path: string): boolean {
		const ramp = this.#ramps.get(path)
		if (!ramp) return false
		this.#ramps.delete(path)
		this.#stopTimerIfIdle()
		ramp.resolve('cancelled')
		return true
	}

	/** Stop every ramp where it is */
	cancelAll(): void {
		for (const path of [...this.#ramps.keys()]) this.cancel(path)
	}

	#tick(): void {
		const now = this.#clock()
		for (const [path, ramp] of [...this.#ramps]) {
			const { spec } = ramp
			const progress = (now - ramp.start) / spec.duration
			if (progress >= 1) {
				this.#ramps.delete(path)
				ramp.position = spec.to
				sendStep(spec, spec.target, true).then(() => ramp.resolve('done'), ramp.reject)
				continue
			}
			const displayed = spec.from + spec.easing(Math.max(0, progress)) * (spec.to - spec.from)
			let value: number
			try {
				value = spec.toDevice(displayed)
			} catch (e) {
				this.#onStepError(path, e)
				continue
			}
			if (value === ramp.lastSent) continue
			ramp.lastSent = value
			ramp.position = displayed
			sendStep(spec, value, false).catch((e: unknown) => this.#onStepError(path, e))
		}
		this.#stopTimerIfIdle()
	}

	#stopTimerIfIdle(): void {
		if (this.#ramps.size === 0 && this.#timer !== undefined) {
			clearInterval(this.#timer)
			this.#timer = undefined
		}
	}
}

/** Send a step, as a promise even if the send function throws: one ramp's failure mustn't stop the others' steps */
async function sendStep(spec: RampSpec, value: number, final: boolean): Promise<void> {
	return spec.send(value, final)
}

/** The step interval, held to 20..1000 ms; anything else (missing, not a number) is the default */
function validInterval(interval: number | undefined): number {
	if (typeof interval !== 'number' || !Number.isFinite(interval)) return rampIntervalDefault
	return Math.min(1000, Math.max(20, Math.round(interval)))
}
