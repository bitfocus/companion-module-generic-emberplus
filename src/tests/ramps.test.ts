import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EasingChoices, easingOf, RampEngine, rampIntervalDefault, type RampSpec } from '../ramps.js'

// The engine on its own: a clock the tests set, fake timers for its one interval, and a send function that records
// what it is given. No client and no Companion.

let now = 0
const clock = () => now

/** Move the clock and the fake timers on together, one interval at a time */
async function advance(ms: number, interval = 100): Promise<void> {
	for (let elapsed = 0; elapsed < ms; elapsed += interval) {
		now += interval
		await vi.advanceTimersByTimeAsync(interval)
	}
}

/** A ramp from 0 to 10 over a second, linear, rounding to whole device values, recording what it sends */
function ramp(overrides: Partial<RampSpec> = {}) {
	const sent: Array<[value: number, final: boolean]> = []
	const spec: RampSpec = {
		from: 0,
		to: 10,
		target: 10,
		duration: 1000,
		easing: easingOf('linear'),
		toDevice: (displayed) => Math.round(displayed),
		send: async (value, final) => {
			sent.push([value, final])
		},
		...overrides,
	}
	return { spec, sent }
}

beforeEach(() => {
	now = 0
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('RampEngine', () => {
	it('sends a step each interval, then the exact target as the final step, and resolves done', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const { spec, sent } = ramp()
		const { done } = engine.start('1.1', spec)
		await advance(1000)
		expect(sent).toEqual([
			[1, false],
			[2, false],
			[3, false],
			[4, false],
			[5, false],
			[6, false],
			[7, false],
			[8, false],
			[9, false],
			[10, true],
		])
		await expect(done).resolves.toBe('done')
		expect(engine.has('1.1')).toBe(false)
	})

	it('follows the easing curve', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const { spec, sent } = ramp({ easing: easingOf('quadratic-in'), toDevice: (displayed) => displayed })
		engine.start('1.1', spec)
		await advance(1000)
		const steps = sent.filter(([, final]) => !final).map(([value]) => value)
		const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((tenth) => 10 * (tenth / 10) ** 2)
		expect(steps).toHaveLength(expected.length)
		steps.forEach((value, i) => expect(value).toBeCloseTo(expected[i]))
	})

	// An Integer over a small range: many steps round to the same device value
	it("doesn't send a step that gives the same device value as the last", async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const { spec, sent } = ramp({ to: 2, target: 2 })
		engine.start('1.1', spec)
		await advance(1000)
		expect(sent).toEqual([
			[0, false],
			[1, false],
			[2, false],
			[2, true],
		])
	})

	it('works each step out from the clock, so a late tick does not stretch the ramp', async () => {
		const engine = new RampEngine({ clock, interval: 100, onStepError: () => undefined })
		const { spec, sent } = ramp({ toDevice: (displayed) => displayed })
		engine.start('1.1', spec)
		// One tick, but 950 ms gone by the clock: the step is 95% of the way
		now = 950
		await vi.advanceTimersByTimeAsync(100)
		expect(sent).toEqual([[9.5, false]])
		now = 1000
		await vi.advanceTimersByTimeAsync(100)
		expect(sent.at(-1)).toEqual([10, true])
	})

	it('runs its timer only while there are ramps', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		expect(vi.getTimerCount()).toBe(0)
		engine.start('1.1', ramp().spec)
		engine.start('1.2', ramp({ duration: 500 }).spec)
		expect(vi.getTimerCount()).toBe(1)
		await advance(500)
		expect(vi.getTimerCount()).toBe(1)
		await advance(500)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('stops a ramp on the path a new one starts on, which can start from where the first had reached', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const first = ramp()
		const { done } = engine.start('1.1', first.spec)
		await advance(300)
		expect(engine.position('1.1')).toBe(3)

		const second = ramp({ from: engine.position('1.1')!, to: 0, target: 0 })
		engine.start('1.1', second.spec)
		await expect(done).resolves.toBe('cancelled')
		await advance(1000)
		expect(first.sent.at(-1)).toEqual([3, false])
		expect(second.sent[0]).toEqual([3, false])
		expect(second.sent.at(-1)).toEqual([0, true])
	})

	it('gives the start as the position before the first step', () => {
		const engine = new RampEngine({ clock, interval: 100 })
		engine.start('1.1', ramp({ from: 4 }).spec)
		expect(engine.position('1.1')).toBe(4)
		expect(engine.position('1.2')).toBeUndefined()
	})

	it('stops one ramp with cancel, and every ramp with cancelAll, where they are', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const a = ramp()
		const b = ramp()
		const c = ramp()
		const ha = engine.start('1.1', a.spec)
		const hb = engine.start('1.2', b.spec)
		const hc = engine.start('1.3', c.spec)
		await advance(200)

		expect(engine.cancel('1.1')).toBe(true)
		expect(engine.cancel('1.1')).toBe(false)
		await expect(ha.done).resolves.toBe('cancelled')
		await advance(200)
		expect(a.sent.at(-1)).toEqual([2, false])
		expect(b.sent.at(-1)).toEqual([4, false])

		engine.cancelAll()
		await expect(hb.done).resolves.toBe('cancelled')
		await expect(hc.done).resolves.toBe('cancelled')
		await advance(1000)
		expect(b.sent.at(-1)).toEqual([4, false])
		expect(c.sent.some(([, final]) => final)).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('cancels through its handle only that ramp, not a newer one on the same path', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const first = engine.start('1.1', ramp().spec)
		engine.start('1.1', ramp().spec)
		first.cancel()
		expect(engine.has('1.1')).toBe(true)
	})

	it('carries on after a step fails to send, and reports it', async () => {
		const onStepError = vi.fn()
		const engine = new RampEngine({ clock, interval: 100, onStepError })
		const sent: number[] = []
		const { done } = engine.start(
			'1.1',
			ramp({
				send: async (value, final) => {
					if (value === 3 && !final) throw new Error('refused')
					sent.push(value)
				},
			}).spec,
		)
		await advance(1000)
		await expect(done).resolves.toBe('done')
		expect(onStepError).toHaveBeenCalledWith('1.1', expect.objectContaining({ message: 'refused' }))
		expect(sent).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10])
	})

	// A send function that throws rather than rejecting mustn't stop the other ramps' steps
	it("carries on with the other ramps when one's send throws", async () => {
		const engine = new RampEngine({ clock, interval: 100, onStepError: () => undefined })
		engine.start(
			'1.1',
			ramp({
				send: () => {
					throw new Error('thrown')
				},
			}).spec,
		)
		const other = ramp()
		engine.start('1.2', other.spec)
		await advance(300)
		expect(other.sent).toEqual([
			[1, false],
			[2, false],
			[3, false],
		])
	})

	it('skips a step whose device value fails, and reports it', async () => {
		const onStepError = vi.fn()
		const engine = new RampEngine({ clock, interval: 100, onStepError })
		const { spec, sent } = ramp({
			toDevice: (displayed) => {
				if (Math.round(displayed) === 5) throw new Error('no value')
				return Math.round(displayed)
			},
		})
		engine.start('1.1', spec)
		await advance(1000)
		expect(onStepError).toHaveBeenCalledTimes(1)
		expect(sent.map(([value]) => value)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10])
	})

	it('rejects when the final step fails', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const { done } = engine.start(
			'1.1',
			ramp({
				send: async (_value, final) => {
					if (final) throw new Error('no reply')
				},
			}).spec,
		)
		const settled = expect(done).rejects.toThrow('no reply')
		await advance(1000)
		await settled
	})

	describe('a duration of one step interval or less', () => {
		it.each([0, 50, 100, -5, NaN])('%s ms sets the target at once, without a timer', async (duration) => {
			const engine = new RampEngine({ clock, interval: 100 })
			const { spec, sent } = ramp({ duration })
			const { done } = engine.start('1.1', spec)
			expect(sent).toEqual([[10, true]])
			expect(vi.getTimerCount()).toBe(0)
			expect(engine.has('1.1')).toBe(false)
			await expect(done).resolves.toBe('done')
		})

		it('stops a long ramp on the path', async () => {
			const engine = new RampEngine({ clock, interval: 100 })
			const long = engine.start('1.1', ramp().spec)
			await advance(200)
			const { spec, sent } = ramp({ duration: 0, target: 0 })
			engine.start('1.1', spec)
			await expect(long.done).resolves.toBe('cancelled')
			expect(sent).toEqual([[0, true]])
			expect(vi.getTimerCount()).toBe(0)
		})

		it('a little over one interval gives one step before the target', async () => {
			const engine = new RampEngine({ clock, interval: 100 })
			const { spec, sent } = ramp({ duration: 101, toDevice: (displayed) => displayed })
			engine.start('1.1', spec)
			await advance(200)
			expect(sent).toHaveLength(2)
			expect(sent[0][1]).toBe(false)
			expect(sent[1]).toEqual([10, true])
		})
	})

	it('takes a new step interval while ramps run', async () => {
		const engine = new RampEngine({ clock, interval: 100 })
		const { spec, sent } = ramp({ to: 100, target: 100 })
		engine.start('1.1', spec)
		await advance(200)
		expect(sent).toHaveLength(2)
		engine.setStepInterval(50)
		expect(engine.interval).toBe(50)
		await advance(200, 50)
		expect(sent).toHaveLength(6)
	})

	it('holds the step interval to 20..1000 ms, and takes the default for none', () => {
		const engine = new RampEngine()
		expect(engine.interval).toBe(rampIntervalDefault)
		engine.setStepInterval(5)
		expect(engine.interval).toBe(20)
		engine.setStepInterval(5000)
		expect(engine.interval).toBe(1000)
		engine.setStepInterval(undefined)
		expect(engine.interval).toBe(rampIntervalDefault)
		engine.setStepInterval(Number.NaN)
		expect(engine.interval).toBe(rampIntervalDefault)
	})
})

describe('RampEngine with its default clock', () => {
	// performance.now, called unbound, throws: the default must call it on performance
	it('runs a ramp to its end', async () => {
		vi.useRealTimers()
		const engine = new RampEngine({ interval: 20 })
		const { spec, sent } = ramp({ duration: 100 })
		await expect(engine.start('1.1', spec).done).resolves.toBe('done')
		expect(sent.at(-1)).toEqual([10, true])
		expect(engine.now()).toBeGreaterThan(0)
	})
})

describe('easing choices', () => {
	it.each(EasingChoices.map((choice) => [choice.id] as const))(
		'%s runs from 0 to 1 without passing either end or turning back',
		(id) => {
			const curve = easingOf(id)
			expect(curve(0)).toBeCloseTo(0, 10)
			expect(curve(1)).toBeCloseTo(1, 10)
			let previous = curve(0)
			for (let i = 1; i <= 1000; i++) {
				const value = curve(i / 1000)
				expect(value).toBeGreaterThanOrEqual(previous - 1e-12)
				expect(value).toBeLessThanOrEqual(1 + 1e-12)
				previous = value
			}
		},
	)

	it('offers every curve once, Linear first, as the default', () => {
		const ids = EasingChoices.map((choice) => choice.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toHaveLength(22)
		expect(ids[0]).toBe('linear')
	})

	it('ramps in a straight line for an easing this version does not offer', () => {
		for (const id of ['bounce-out', 'elastic-in', undefined, 3, 'toString']) {
			expect(easingOf(id)(0.25)).toBe(0.25)
		}
	})
})
