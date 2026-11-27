import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { subscribeParameterAction, learnSetValueActionOptions, setValue } from '../../actions/parameter.js'
import { EmberPlusState } from '../../state.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other action tests do. The library's model, util
// and the state are real: the actions convert values with the library's helpers, which these tests exercise
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

type ActionType = 'setValueString' | 'setValueBoolean' | 'setValueInt' | 'setValueReal' | 'setValueEnum'

const parameterTypeOf: Record<ActionType, EmberModel.ParameterType> = {
	setValueString: ParameterType.String,
	setValueBoolean: ParameterType.Boolean,
	setValueInt: ParameterType.Integer,
	setValueReal: ParameterType.Real,
	setValueEnum: ParameterType.Enum,
}

/** Parameter 0.1 (numbered node 1 under node 0), as the client's tree holds it */
function parameterNode(parameterType: EmberModel.ParameterType, fields: Record<string, unknown> = {}) {
	return {
		number: 1,
		parent: { number: 0 },
		contents: { type: ElementType.Parameter, parameterType, access: ParameterAccess.ReadWrite, ...fields },
	} as any
}

/** The node registered, and in the state, as registration leaves a parameter */
function harness(node: any) {
	const state = new EmberPlusState()
	if (node?.contents?.type === ElementType.Parameter) state.updateParameterMap('0.1', node)
	return {
		state,
		self: { registerNewParameter: vi.fn().mockResolvedValue(node), ramps: { cancel: vi.fn() } } as any,
		client: { setValue: vi.fn().mockResolvedValue({ response: Promise.resolve() }) } as any,
		queue: { add: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()) } as any,
	}
}

function action(options: Record<string, unknown> = {}) {
	return { id: 'act1', options: { path: '0.1', ...options } } as any
}

const ctx = { signal: new AbortController().signal } as any

/** Run a Set Value action on parameter 0.1 with the fields given; the value it sent, or undefined for none */
async function run(actionType: ActionType, options: Record<string, unknown>, fields: Record<string, unknown> = {}) {
	const node = parameterNode(parameterTypeOf[actionType], fields)
	const h = harness(node)
	await setValue(
		h.self,
		h.client,
		parameterTypeOf[actionType],
		actionType as never,
		h.state,
		h.queue,
	)(action(options), ctx)
	return { ...h, node, sent: h.client.setValue.mock.calls[0]?.[1] as unknown }
}

async function learn(actionType: ActionType, fields: Record<string, unknown>, options: Record<string, unknown> = {}) {
	const h = harness(parameterNode(parameterTypeOf[actionType], fields))
	return learnSetValueActionOptions(h.state, parameterTypeOf[actionType], actionType as never)(action(options), ctx)
}

describe('subscribeParameterAction', () => {
	// Whether a parameter gets a variable is the Connection Variables config option's, not the action's
	it('registers the path, whatever the options', async () => {
		const self = { registerNewParameter: vi.fn() } as any
		await subscribeParameterAction(self)(action({ toggle: true, relative: true, asEnum: true }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1')
	})
})

describe('learnSetValueActionOptions', () => {
	it('returns undefined when path has no parameter', async () => {
		const h = harness(undefined)
		const result = await learnSetValueActionOptions(
			h.state,
			ParameterType.Integer,
			'setValueInt' as never,
		)(action(), ctx)
		expect(result).toBeUndefined()
	})

	it('returns undefined when the type does not match', async () => {
		const h = harness(parameterNode(ParameterType.String, { value: 'hello' }))
		const result = await learnSetValueActionOptions(
			h.state,
			ParameterType.Integer,
			'setValueInt' as never,
		)(action(), ctx)
		expect(result).toBeUndefined()
	})

	it('does not mutate the original action.options', async () => {
		const h = harness(parameterNode(ParameterType.String, { value: 'hello' }))
		const original = action({ value: 'original', parseEscapeChars: false })
		await learnSetValueActionOptions(h.state, ParameterType.String, 'setValueString' as never)(original, ctx)
		expect(original.options.value).toBe('original')
	})

	it('String: learns the raw string when parseEscapeChars is false', async () => {
		expect((await learn('setValueString', { value: 'a\nb' }, { parseEscapeChars: false }))?.value).toBe('a\nb')
	})

	it('String: writes escape characters out when parseEscapeChars is true', async () => {
		expect((await learn('setValueString', { value: 'a\nb' }, { parseEscapeChars: true }))?.value).toBe('a\\nb')
	})

	it('Boolean: learns only the value, keeping the path and any expression in it', async () => {
		expect(await learn('setValueBoolean', { value: true }, { toggle: false })).toEqual({ value: true })
	})

	it('Enum: sets min to 0 when minimum is not defined', async () => {
		expect((await learn('setValueEnum', { value: 1, enumeration: 'Off\nOn' }))?.min).toBe(0)
	})

	it('Enum: learns the entry from the enumeration', async () => {
		expect((await learn('setValueEnum', { value: 1, enumeration: 'Off\nOn' }))?.enumValue).toBe('On')
	})

	it('Enum: learns the entry from the enumMap, before the enumeration', async () => {
		const enumMap = new Map([
			['Mute', 10],
			['Live', 20],
		])
		expect((await learn('setValueEnum', { value: 20, enumeration: 'Off\nOn', enumMap }))?.enumValue).toBe('Live')
	})

	it('Enum: learns no entry for a parameter without one', async () => {
		expect(await learn('setValueEnum', { value: 1 })).not.toHaveProperty('enumValue')
	})

	// The action takes the value as displayed, which the parameter's factor or formula converts
	it('Int: learns the value as displayed, by the factor, and no factor', async () => {
		const result = await learn('setValueInt', { value: 500, factor: 100 })
		expect(result?.value).toBe(5)
		expect(result).not.toHaveProperty('factor')
	})

	// An action upgraded with Device Units takes the displayed value once learned
	it('Int: clears Device Units, as the learned value is as displayed', async () => {
		expect((await learn('setValueInt', { value: 500, factor: 100 }, { deviceUnits: true }))?.deviceUnits).toBe(false)
	})

	// As the recorder and the variables do: Learn failed outright, learning nothing
	it("Int: learns the device value, and leaves Device Units, for a formula that can't be computed", async () => {
		const result = await learn('setValueInt', { value: 7, minimum: 0, formula: '$ +' }, { deviceUnits: true })
		expect(result).toEqual({ value: 7, min: 0 })
	})

	it('Int: learns the value as displayed, by the formula', async () => {
		expect((await learn('setValueInt', { value: 10, formula: '$ * 2\n$ / 2' }))?.value).toBe(20)
	})

	it('Real: learns the value as displayed, by the formula, and the limits, which are the device units', async () => {
		const result = await learn('setValueReal', { value: 3.14, minimum: 0, maximum: 10, formula: '$ * 2\n$ / 2' })
		expect(result).toEqual({ value: 6.28, min: 0, max: 10 })
	})

	it('returns undefined for unknown actionType', async () => {
		const h = harness(parameterNode(ParameterType.Integer, { value: 1 }))
		const result = await learnSetValueActionOptions(h.state, ParameterType.Integer, 'unknown' as never)(action(), ctx)
		expect(result).toBeUndefined()
	})
})

describe('setValue node validation', () => {
	async function attempt(node: any) {
		const h = harness(node)
		return setValue(h.self, h.client, ParameterType.Integer, 'setValueInt' as never, h.state, h.queue)(action(), ctx)
	}

	it('throws when there is no parameter at the path', async () => {
		await expect(attempt(null)).rejects.toThrow('not found or not a parameter')
	})

	it('throws when the node is not a parameter', async () => {
		await expect(attempt({ number: 1, contents: { type: ElementType.Matrix } })).rejects.toThrow('not a parameter')
	})

	it.each([ParameterAccess.None, ParameterAccess.Read])('throws when the access is %s', async (access) => {
		await expect(attempt(parameterNode(ParameterType.Integer, { access }))).rejects.toThrow('insufficient permissions')
	})

	it('throws when the parameter type does not match', async () => {
		await expect(attempt(parameterNode(ParameterType.String))).rejects.toThrow('is not of type')
	})
})

describe('setValue String', () => {
	it('sends the string as it is', async () => {
		expect((await run('setValueString', { value: 'a\\nb', parseEscapeChars: false })).sent).toBe('a\\nb')
	})

	it('reads escape characters when parseEscapeChars is true', async () => {
		expect((await run('setValueString', { value: 'a\\nb', parseEscapeChars: true })).sent).toBe('a\nb')
	})

	// What goes on the wire is the library's (tests/emberplus-connection.test.ts): it sends only the path and the value.
	// The module hands it the cached node, and leaves the client's tree alone until the provider reports
	it('hands the client the cached node, leaving its value until the provider reports', async () => {
		const { client, node } = await run('setValueString', { value: 'new' }, { identifier: 'sdp', value: 'old' })
		expect(client.setValue).toHaveBeenCalledWith(node, 'new', false)
		expect(node.contents.value).toBe('old')
	})
})

describe('setValue Integer', () => {
	// As displayed, converted by the library's deviceValue: by the parameter's factor
	it('multiplies the value by the parameter factor', async () => {
		expect((await run('setValueInt', { value: 5 }, { factor: 100 })).sent).toBe(500)
	})

	// The module floored the product, so a value whose product came out a little under the whole number lost one
	it('rounds to a whole number', async () => {
		expect((await run('setValueInt', { value: 0.29 }, { factor: 100 })).sent).toBe(29)
		expect((await run('setValueInt', { value: 2.5 })).sent).toBe(3)
	})

	it('converts by the formula, consumer to provider, before any factor', async () => {
		expect((await run('setValueInt', { value: 20 }, { formula: '$ * 2\n$ / 2', factor: 10 })).sent).toBe(10)
	})

	it('fails for a formula without a second expression, as a read-only one needs none', async () => {
		await expect(run('setValueInt', { value: 20 }, { formula: '$ * 2' })).rejects.toThrow('no second expression')
	})

	it('holds the value to the parameter limits', async () => {
		expect((await run('setValueInt', { value: 50 }, { maximum: 40 })).sent).toBe(40)
	})

	it('sends nothing for a value beyond the range Ember+ allows', async () => {
		expect((await run('setValueInt', { value: 2 ** 53 }, {})).sent).toBeUndefined()
	})

	it('sends nothing for a value that is no number', async () => {
		expect((await run('setValueInt', { value: 'x' })).sent).toBeUndefined()
	})

	it('passes the abort signal of the action to the queue', async () => {
		const { queue } = await run('setValueInt', { value: 5 })
		expect(queue.add).toHaveBeenCalledWith(expect.any(Function), { signal: ctx.signal })
	})
})

// Actions from before 3.0 with a Factor other than 1 keep sending value x Factor, in the device's units
describe('setValue Integer with Device Units', () => {
	it('multiplies the value by the action Factor, rounding down, whatever the parameter factor or formula', async () => {
		const options = { value: 2.5, deviceUnits: true, factor: 3 }
		expect((await run('setValueInt', options, { factor: 100, formula: '$ * 2\n$ / 2' })).sent).toBe(7)
	})

	it('adds a relative change to the device value', async () => {
		const options = { value: 2, relative: true, deviceUnits: true, factor: 10 }
		expect((await run('setValueInt', options, { value: 50, factor: 100 })).sent).toBe(70)
	})

	it('takes the displayed value once Device Units is unticked', async () => {
		const options = { value: 2, deviceUnits: false, factor: 10 }
		expect((await run('setValueInt', options, { factor: 100 })).sent).toBe(200)
	})
})

describe('setValue Real', () => {
	it('sends the value as it is without a factor or formula', async () => {
		expect((await run('setValueReal', { value: 3.14 })).sent).toBe(3.14)
	})

	// A factor is for a device that can't send decimals, so for integers; a Real converts by its formula
	it('converts by the formula, without rounding', async () => {
		expect((await run('setValueReal', { value: 3 }, { formula: '$ * 10\n$ / 10' })).sent).toBe(0.3)
	})

	it('sends nothing for a value that is no number', async () => {
		expect((await run('setValueReal', { value: 'x' })).sent).toBeUndefined()
	})
})

describe('setValue relative numbers', () => {
	// The change is to the displayed value; the limits are the device's units
	it('Integer: adds to the displayed value, and converts the sum', async () => {
		expect((await run('setValueInt', { value: 1.5, relative: true }, { value: 50, factor: 10 })).sent).toBe(65)
	})

	it('Integer: holds the result to the action limits, in the device units', async () => {
		const options = { value: 5, relative: true, min: 0, max: 60 }
		expect((await run('setValueInt', options, { value: 50, factor: 10 })).sent).toBe(60)
	})

	it('Real: adds to the value the formula displays', async () => {
		const options = { value: 1, relative: true }
		const sent = (await run('setValueReal', options, { value: 0.2, formula: '$ * 10\n$ / 10' })).sent
		expect(sent).toBeCloseTo(0.3)
	})

	// The value was read before the action waited in the queue, so a change made meanwhile (an earlier press's report,
	// or the device) was lost
	it('adds to the value the parameter has when the action leaves the queue', async () => {
		const node = parameterNode(ParameterType.Integer, { value: 10 })
		const h = harness(node)
		h.queue.add.mockImplementation(async (fn: () => Promise<void>) => {
			h.state.updateParameterMap('0.1', parameterNode(ParameterType.Integer, { value: 20 }))
			return fn()
		})
		await setValue(
			h.self,
			h.client,
			ParameterType.Integer,
			'setValueInt' as never,
			h.state,
			h.queue,
		)(action({ value: 1, relative: true }), ctx)
		expect(h.client.setValue.mock.calls[0]?.[1]).toBe(21)
	})

	it('starts from 0 for a parameter without a value', async () => {
		expect((await run('setValueInt', { value: 3, relative: true }, { value: null })).sent).toBe(3)
	})
})

describe('setValue Enum', () => {
	it('sends the value given', async () => {
		expect((await run('setValueEnum', { value: 2 }, { enumeration: 'A\nB\nC' })).sent).toBe(2)
	})

	it('asEnum: sends the place of the entry in the enumeration', async () => {
		expect((await run('setValueEnum', { asEnum: true, enumValue: 'On' }, { enumeration: 'Off\nOn' })).sent).toBe(1)
	})

	// The module split the enumeration, so a device's enumMap, whose values needn't be consecutive, was misread
	it('asEnum: sends the value of the entry in the enumMap', async () => {
		const enumMap = new Map([
			['Mute', 10],
			['Live', 20],
		])
		expect((await run('setValueEnum', { asEnum: true, enumValue: 'Live' }, { enumMap })).sent).toBe(20)
	})

	it.each(['Hidden', '~Hidden'])('asEnum: finds a hidden entry by %j', async (enumValue) => {
		expect((await run('setValueEnum', { asEnum: true, enumValue }, { enumeration: 'Off\n~Hidden' })).sent).toBe(1)
	})

	it('asEnum: throws when there is no entry of the name', async () => {
		await expect(run('setValueEnum', { asEnum: true, enumValue: 'Unknown' }, { enumeration: 'Off' })).rejects.toThrow(
			'No entry Unknown',
		)
	})
})

describe('setValue relative Enum', () => {
	const enumMap = new Map([
		['Low', 10],
		['~Service', 15],
		['Mid', 20],
		['High', 30],
	])

	it('steps through the entries in order, not by value', async () => {
		expect((await run('setValueEnum', { value: 1, relative: true }, { value: 20, enumMap })).sent).toBe(30)
		expect((await run('setValueEnum', { value: -1, relative: true }, { value: 30, enumMap })).sent).toBe(20)
	})

	// A generic module can't know why a device hides an entry ("~"), so it offers every value the device accepts
	it('steps onto a hidden entry as onto any other', async () => {
		expect((await run('setValueEnum', { value: 1, relative: true }, { value: 10, enumMap })).sent).toBe(15)
	})

	it('stops at the last entry', async () => {
		expect((await run('setValueEnum', { value: 5, relative: true }, { value: 10, enumMap })).sent).toBe(30)
	})

	it('steps only through entries within the action limits', async () => {
		const options = { value: 2, relative: true, min: 0, max: 20 }
		expect((await run('setValueEnum', options, { value: 10, enumMap })).sent).toBe(20)
	})

	// Such a value isn't settable, so it wasn't found among the settable entries, and the step started from an end
	it('steps from a hidden entry the parameter is on, to its neighbours', async () => {
		const enumeration = 'Off\n~Muted\nOn'
		expect((await run('setValueEnum', { value: 1, relative: true }, { value: 1, enumeration })).sent).toBe(2)
		expect((await run('setValueEnum', { value: -1, relative: true }, { value: 1, enumeration })).sent).toBe(0)
	})

	it('steps from a value outside the action limits to the nearest settable entry', async () => {
		const options = { value: 1, relative: true, min: 0, max: 20 }
		expect((await run('setValueEnum', options, { value: 30, enumMap })).sent).toBe(20)
	})

	it('steps by value for a parameter without entries', async () => {
		expect((await run('setValueEnum', { value: 1, relative: true }, { value: 2 })).sent).toBe(3)
	})
})

describe('setValue Boolean', () => {
	it('sends true', async () => {
		expect((await run('setValueBoolean', { value: true })).sent).toBe(true)
	})

	it('sends false', async () => {
		expect((await run('setValueBoolean', { value: false })).sent).toBe(false)
	})

	it('toggle: inverts the current value', async () => {
		expect((await run('setValueBoolean', { toggle: true }, { value: true })).sent).toBe(false)
	})
})
