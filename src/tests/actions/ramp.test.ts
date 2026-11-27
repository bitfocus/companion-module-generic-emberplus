import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { learnRampValue, rampValue, RampWaitLimit, RampWaitMargin, stopRamp } from '../../actions/ramp.js'
import { setValue } from '../../actions/parameter.js'
import { RampEngine } from '../../ramps.js'
import { EmberPlusState } from '../../state.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other action tests do. The library's model, the
// state and the ramp engine are real; the engine runs on fake timers, with Date.now (faked) as its clock
vi.mock('../../actions.js', () => ({
	ActionId: {
		SetValueString: 'setValueString',
		SetValueBoolean: 'setValueBoolean',
		SetValueInt: 'setValueInt',
		SetValueReal: 'setValueReal',
		SetValueEnum: 'setValueEnum',
	},
}))

const { ElementType, ParameterType, ParameterAccess } = EmberModel

/** Parameter 0.1 (numbered node 1 under node 0), as the client's tree holds it */
function parameterNode(parameterType: EmberModel.ParameterType, fields: Record<string, unknown> = {}) {
	return {
		number: 1,
		parent: { number: 0 },
		contents: { type: ElementType.Parameter, parameterType, access: ParameterAccess.ReadWrite, ...fields },
	} as any
}

/** An Integer gain in tenths of a dB (factor 10), at 0 dB */
const gain = (fields: Record<string, unknown> = {}) =>
	parameterNode(ParameterType.Integer, { value: 0, factor: 10, ...fields })

function harness(node: any, { registerDelay = 0, current = true } = {}) {
	const state = new EmberPlusState()
	if (node?.contents?.type === ElementType.Parameter) state.updateParameterMap('0.1', node)
	const ramps = new RampEngine({ clock: () => Date.now(), interval: 100 })
	const client = { setValue: vi.fn().mockResolvedValue({ response: Promise.resolve() }) } as any
	const self = {
		ramps,
		isCurrentClient: vi.fn().mockReturnValue(current),
		registerNewParameter: vi.fn(async () => {
			if (registerDelay > 0) await new Promise((resolve) => setTimeout(resolve, registerDelay))
			return node
		}),
	} as any
	const ctx = (controller = new AbortController()) => ({ signal: controller.signal }) as any
	const run = async (options: Record<string, unknown>, context = ctx()) =>
		rampValue(
			self,
			client,
			state,
		)(
			{
				id: 'act1',
				options: { path: '0.1', duration: 1000, easing: 'linear', relative: false, ...options },
			} as any,
			context,
		)
	/** The values sent, and whether each was the final step */
	const sent = () => client.setValue.mock.calls.map(([, value, final]: [unknown, number, boolean]) => [value, final])
	return { state, ramps, client, self, run, sent, ctx }
}

/** Whether a promise has settled, after the microtasks queued so far */
async function settled(promise: Promise<unknown>): Promise<boolean> {
	let done = false
	promise.then(
		() => (done = true),
		() => (done = true),
	)
	await vi.advanceTimersByTimeAsync(0)
	return done
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('Ramp Value', () => {
	it.each([ParameterType.Enum, ParameterType.String, ParameterType.Boolean])(
		'refuses a parameter of type %s',
		async (type) => {
			const h = harness(parameterNode(type, { value: 0 }))
			await expect(h.run({ value: 1 })).rejects.toThrow('is not an Integer or Real parameter')
			expect(h.client.setValue).not.toHaveBeenCalled()
		},
	)

	it('refuses a read-only parameter', async () => {
		const h = harness(gain({ access: ParameterAccess.Read }))
		await expect(h.run({ value: 1 })).rejects.toThrow("Can't write to 0.1")
	})

	it('refuses a path that is no parameter', async () => {
		const h = harness(undefined)
		await expect(h.run({ value: 1 })).rejects.toThrow('not found or not a parameter')
	})

	it('steps in displayed units, converting each by the factor, and sends the exact target last', async () => {
		const h = harness(gain())
		const done = h.run({ value: 1 })
		await vi.advanceTimersByTimeAsync(1000)
		await done
		expect(h.sent()).toEqual([
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
	})

	it('converts the target by the formula', async () => {
		const h = harness(parameterNode(ParameterType.Integer, { value: 0, formula: '$ / 10\n$ * 10' }))
		const done = h.run({ value: 5, duration: 0 })
		await done
		expect(h.sent()).toEqual([[50, true]])
	})

	it('ramps a Real', async () => {
		const h = harness(parameterNode(ParameterType.Real, { value: 0.5 }))
		const done = h.run({ value: 1.5, duration: 200 })
		await vi.advanceTimersByTimeAsync(200)
		await done
		expect(h.sent()).toEqual([
			[1, false],
			[1.5, true],
		])
	})

	it("holds the target to the parameter's maximum", async () => {
		const h = harness(gain({ maximum: 60 }))
		await h.run({ value: 12, duration: 0 })
		expect(h.sent()).toEqual([[60, true]])
	})

	it('sends nothing for a target that is no number', async () => {
		const h = harness(gain())
		await h.run({ value: 'x', duration: 0 })
		expect(h.client.setValue).not.toHaveBeenCalled()
		expect(h.ramps.has('0.1')).toBe(false)
	})

	it('sends no step to a client a host change has replaced', async () => {
		const h = harness(gain(), { current: false })
		const done = h.run({ value: 1 })
		await vi.advanceTimersByTimeAsync(1000)
		await done
		expect(h.client.setValue).not.toHaveBeenCalled()
	})

	describe('relative', () => {
		it('adds the change to the current displayed value', async () => {
			const h = harness(gain({ value: 20 }))
			await h.run({ value: 3, relative: true, duration: 0 })
			expect(h.sent()).toEqual([[50, true]])
		})

		it("stops at the action's Maximum, in device units", async () => {
			const h = harness(gain({ value: 20 }))
			await h.run({ value: 3, relative: true, max: 40, duration: 0 })
			expect(h.sent()).toEqual([[40, true]])
		})

		it('rounds an Integer target', async () => {
			const h = harness(gain())
			await h.run({ value: 0.26, relative: true, duration: 0 })
			expect(h.sent()).toEqual([[3, true]])
		})

		// The reports lag the steps, so the state still says 0 dB: the ramp starts from where the first had reached
		it('during another ramp, stops it, and adds the change to where it had reached', async () => {
			const h = harness(gain())
			const first = h.run({ value: 1 })
			await vi.advanceTimersByTimeAsync(300)
			const second = h.run({ value: 0.5, relative: true })
			await expect(settled(first)).resolves.toBe(true)
			await vi.advanceTimersByTimeAsync(1000)
			await second
			const values = h.sent().map(([value]: [number]) => value)
			// 0.3 dB reached, then on to 0.8 dB: no step back toward the state's 0
			expect(values.slice(0, 3)).toEqual([1, 2, 3])
			expect(values.slice(3).every((value: number) => value >= 3)).toBe(true)
			expect(h.sent().at(-1)).toEqual([8, true])
		})
	})

	describe('waiting for the ramp', () => {
		it('waits for a ramp that fits within the time left', async () => {
			const h = harness(gain())
			const done = h.run({ value: 1, duration: 1000 })
			await vi.advanceTimersByTimeAsync(500)
			await expect(settled(done)).resolves.toBe(false)
			await vi.advanceTimersByTimeAsync(500)
			await expect(settled(done)).resolves.toBe(true)
		})

		it("doesn't wait for a longer ramp, which carries on", async () => {
			const h = harness(gain())
			const duration = RampWaitLimit - RampWaitMargin + 1
			await expect(settled(h.run({ value: 1, duration }))).resolves.toBe(true)
			expect(h.ramps.has('0.1')).toBe(true)
			// The final step comes on the first tick after the duration
			await vi.advanceTimersByTimeAsync(duration + 100)
			expect(h.sent().at(-1)).toEqual([10, true])
		})

		// A first press on a path not loaded yet: Companion's time limit has been running all along
		it('counts the time taken registering the parameter', async () => {
			const h = harness(gain(), { registerDelay: 1000 })
			const done = h.run({ value: 1, duration: RampWaitLimit - RampWaitMargin - 500 })
			await vi.advanceTimersByTimeAsync(1000)
			await expect(settled(done)).resolves.toBe(true)
			expect(h.ramps.has('0.1')).toBe(true)
		})

		it('stops a ramp it waits for when the action is aborted', async () => {
			const h = harness(gain())
			const controller = new AbortController()
			const done = h.run({ value: 1 }, h.ctx(controller))
			await vi.advanceTimersByTimeAsync(300)
			controller.abort()
			await expect(settled(done)).resolves.toBe(true)
			expect(h.ramps.has('0.1')).toBe(false)
			await vi.advanceTimersByTimeAsync(1000)
			expect(h.sent().at(-1)).toEqual([3, false])
		})

		it("ignores the abort of an action that didn't wait", async () => {
			const h = harness(gain())
			const controller = new AbortController()
			await h.run({ value: 1, duration: RampWaitLimit }, h.ctx(controller))
			controller.abort()
			expect(h.ramps.has('0.1')).toBe(true)
		})

		it('fails the action when the final value fails, for a ramp it waits for', async () => {
			const h = harness(gain())
			h.client.setValue.mockResolvedValue({ response: Promise.reject(new Error('no reply')) })
			await expect(h.run({ value: 1, duration: 0 })).rejects.toThrow('no reply')
		})
	})

	it('is stopped by a Set Value on its path', async () => {
		const h = harness(gain())
		const queue = { add: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()) } as any
		const done = h.run({ value: 1 })
		await vi.advanceTimersByTimeAsync(300)
		await setValue(
			h.self,
			h.client,
			ParameterType.Integer,
			'setValueInt' as never,
			h.state,
			queue,
		)({ id: 'act2', options: { path: '0.1', value: -1 } } as any, h.ctx())
		await expect(settled(done)).resolves.toBe(true)
		expect(h.ramps.has('0.1')).toBe(false)
		await vi.advanceTimersByTimeAsync(1000)
		expect(h.sent().at(-1)).toEqual([-10, false])
	})
})

describe('Stop Ramp', () => {
	function twoRamps() {
		const ramps = new RampEngine({ clock: () => Date.now(), interval: 100 })
		const spec = {
			from: 0,
			to: 1,
			target: 1,
			duration: 1000,
			easing: (k: number) => k,
			toDevice: (d: number) => d,
			send: async () => undefined,
		}
		ramps.start('0.1', spec)
		ramps.start('0.2', spec)
		return { self: { ramps } as any, ramps }
	}

	it('stops the ramp on its path', () => {
		const { self, ramps } = twoRamps()
		stopRamp(self)({ options: { all: false, path: '0.1' } } as any, {} as any)
		expect(ramps.has('0.1')).toBe(false)
		expect(ramps.has('0.2')).toBe(true)
	})

	it('stops every ramp', () => {
		const { self, ramps } = twoRamps()
		stopRamp(self)({ options: { all: true, path: '0.1' } } as any, {} as any)
		expect(ramps.has('0.1')).toBe(false)
		expect(ramps.has('0.2')).toBe(false)
	})
})

describe('Ramp Value learn', () => {
	const learn = (node: any) => {
		const state = new EmberPlusState()
		state.updateParameterMap('0.1', node)
		return learnRampValue(state)({ id: 'act1', options: { path: '0.1' } } as any, {} as any)
	}

	it('learns the displayed value, and the limits', () => {
		expect(learn(gain({ value: -60, minimum: -900, maximum: 100 }))).toEqual({ value: -6, min: -900, max: 100 })
	})

	it('learns a Real', () => {
		expect(learn(parameterNode(ParameterType.Real, { value: 0.25 }))).toEqual({ value: 0.25 })
	})

	it('learns nothing for another type', () => {
		expect(learn(parameterNode(ParameterType.Enum, { value: 1 }))).toBeUndefined()
	})
})
