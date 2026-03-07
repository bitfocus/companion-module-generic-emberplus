import { describe, it, expect, vi } from 'vitest'
import { subscribeParameterAction, learnSetValueActionOptions, setValue } from './parameter.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('emberplus-connection', () => ({
	EmberClient: class {},
	Model: {
		ParameterType: {
			Boolean: 'boolean',
			Integer: 'integer',
			Real: 'real',
			Enum: 'enum',
			String: 'string',
		},
		ElementType: {
			Parameter: 'parameter',
			Matrix: 'matrix',
		},
		ParameterAccess: {
			None: 'none',
			Read: 'read',
			Write: 'write',
			ReadWrite: 'readWrite',
		},
	},
}))

vi.mock('../actions.js', () => ({
	ActionId: {
		SetValueString: 'setValueString',
		SetValueBoolean: 'setValueBoolean',
		SetValueInt: 'setValueInt',
		SetValueReal: 'setValueReal',
		SetValueEnum: 'setValueEnum',
	},
}))

vi.mock('../util.js', () => ({
	resolveEventPath: vi.fn((action) => action.options.path ?? '0.1'),
	calcRelativeNumber: vi.fn((value) => value + 1),
	checkNumberLimits: vi.fn((value) => value),
	isDefined: vi.fn((v) => v !== undefined && v !== null),
	parseEscapeCharacters: vi.fn((s) => s + '_parsed'),
	substituteEscapeCharacters: vi.fn((s) => s + '_sub'),
}))

vi.mock('../state.js', () => ({
	EmberPlusState: class {},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(params: Record<string, any> = {}) {
	const parameters = new Map<string, any>(Object.entries(params))
	return {
		parameters,
		getCurrentEnumValue: vi.fn(() => 'On'),
		getEnumIndex: vi.fn(() => 1),
	} as any
}

function makeSelf(node: any = null) {
	return {
		registerNewParameter: vi.fn().mockResolvedValue(node),
		logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
	} as any
}

function makeEmberClient() {
	return {
		setValue: vi.fn().mockResolvedValue({ response: Promise.resolve() }),
	} as any
}

function makeQueue() {
	return {
		add: vi.fn().mockImplementation((fn: any) => fn()),
	} as any
}

function makeAction(path = '0.1', options: Record<string, any> = {}) {
	return {
		id: 'act1',
		options: { path, ...options },
	} as any
}

function makeNode(
	type = 'parameter',
	paramType = 'integer',
	access = 'readWrite',
	overrides: Record<string, any> = {},
) {
	return {
		contents: {
			type,
			parameterType: paramType,
			access,
			...overrides,
		},
	} as any
}

const ctx = {} as any

// ---------------------------------------------------------------------------
// subscribeParameterAction
// ---------------------------------------------------------------------------

describe('subscribeParameterAction', () => {
	it('always calls registerNewParameter', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', {}), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', false)
	})

	it('passes createVar=true when variable option is set', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', { variable: true }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('passes createVar=true when toggle option is set', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', { toggle: true }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('passes createVar=true when relative option is set', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', { relative: true }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('passes createVar=true when asEnum option is set', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', { asEnum: true }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('passes createVar=false when none of the variable options are set', async () => {
		const self = makeSelf()
		await subscribeParameterAction(self)(makeAction('0.1', { variable: false, toggle: false }), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', false)
	})
})

// ---------------------------------------------------------------------------
// learnSetValueActionOptions
// ---------------------------------------------------------------------------

describe('learnSetValueActionOptions', () => {
	it('returns undefined when path has no parameter', async () => {
		const state = makeState()
		const result = await learnSetValueActionOptions(
			state,
			'integer' as any,
			'setValueInt' as any,
		)(makeAction('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('returns undefined when paramType does not match', async () => {
		const state = makeState({ '0.1': { parameterType: 'string', value: 'hello' } })
		const result = await learnSetValueActionOptions(
			state,
			'integer' as any,
			'setValueInt' as any,
		)(makeAction('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('does not mutate the original action.options', async () => {
		const state = makeState({ '0.1': { parameterType: 'string', value: 'hello' } })
		const action = makeAction('0.1', { value: 'original', parseEscapeChars: false })
		const originalOptions = action.options
		await learnSetValueActionOptions(state, 'string' as any, 'setValueString' as any)(action, ctx)
		expect(action.options).toBe(originalOptions)
		expect(action.options.value).toBe('original')
	})

	it('String: sets value to raw string when parseEscapeChars is false', async () => {
		const state = makeState({ '0.1': { parameterType: 'string', value: 'hello' } })
		const result = await learnSetValueActionOptions(
			state,
			'string' as any,
			'setValueString' as any,
		)(makeAction('0.1', { parseEscapeChars: false }), ctx)
		expect(result?.value).toBe('hello')
	})

	it('String: substitutes escape chars when parseEscapeChars is true', async () => {
		const state = makeState({ '0.1': { parameterType: 'string', value: 'hello' } })
		const result = await learnSetValueActionOptions(
			state,
			'string' as any,
			'setValueString' as any,
		)(makeAction('0.1', { parseEscapeChars: true }), ctx)
		expect(result?.value).toBe('hello_sub')
	})

	it('Boolean: sets value and valueVar', async () => {
		const state = makeState({ '0.1': { parameterType: 'boolean', value: true } })
		const result = await learnSetValueActionOptions(
			state,
			'boolean' as any,
			'setValueBoolean' as any,
		)(makeAction('0.1'), ctx)
		expect(result?.value).toBe(true)
		expect(result?.valueVar).toBe('true')
	})

	it('Enum: sets min to "0" when minimum is not defined', async () => {
		const state = makeState({ '0.1': { parameterType: 'enum', value: 1, enumeration: 'Off\nOn' } })
		const result = await learnSetValueActionOptions(state, 'enum' as any, 'setValueEnum' as any)(makeAction('0.1'), ctx)
		expect(result?.min).toBe('0')
	})

	it('Enum: sets enumValue from getCurrentEnumValue', async () => {
		const state = makeState({ '0.1': { parameterType: 'enum', value: 1, enumeration: 'Off\nOn' } })
		state.getCurrentEnumValue.mockReturnValue('On')
		const result = await learnSetValueActionOptions(state, 'enum' as any, 'setValueEnum' as any)(makeAction('0.1'), ctx)
		expect(result?.enumValue).toBe('On')
	})

	it('Int: applies factor to value', async () => {
		const state = makeState({ '0.1': { parameterType: 'integer', value: 500, factor: 100 } })
		const result = await learnSetValueActionOptions(
			state,
			'integer' as any,
			'setValueInt' as any,
		)(makeAction('0.1'), ctx)
		expect(result?.factor).toBe('100')
		expect(result?.value).toBe(5) // 500 / 100
	})

	it('Int: sets factor to "1" when no factor on parameter', async () => {
		const state = makeState({ '0.1': { parameterType: 'integer', value: 42 } })
		const result = await learnSetValueActionOptions(
			state,
			'integer' as any,
			'setValueInt' as any,
		)(makeAction('0.1'), ctx)
		expect(result?.factor).toBe('1')
	})

	it('Real: sets value and limits from parameter', async () => {
		const state = makeState({ '0.1': { parameterType: 'real', value: 3.14, minimum: 0, maximum: 10 } })
		const result = await learnSetValueActionOptions(state, 'real' as any, 'setValueReal' as any)(makeAction('0.1'), ctx)
		expect(result?.value).toBe(3.14)
		expect(result?.min).toBe('0')
		expect(result?.max).toBe('10')
	})

	it('returns undefined for unknown actionType', async () => {
		const state = makeState({ '0.1': { parameterType: 'integer', value: 1 } })
		const result = await learnSetValueActionOptions(state, 'integer' as any, 'unknown' as any)(makeAction('0.1'), ctx)
		expect(result).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// setValue — node validation
// ---------------------------------------------------------------------------

describe('setValue node validation', () => {
	it('throws when registerNewParameter returns null', async () => {
		const self = makeSelf(null)
		const fn = setValue(self, makeEmberClient(), 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1'), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	it('throws when node is not a parameter type', async () => {
		const self = makeSelf(makeNode('matrix', 'integer', 'readWrite'))
		const fn = setValue(self, makeEmberClient(), 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1'), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	it('throws when node access is None', async () => {
		const self = makeSelf(makeNode('parameter', 'integer', 'none'))
		const fn = setValue(self, makeEmberClient(), 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1'), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	it('throws when node access is Read', async () => {
		const self = makeSelf(makeNode('parameter', 'integer', 'read'))
		const fn = setValue(self, makeEmberClient(), 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1'), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	it('throws when parameterType does not match', async () => {
		const self = makeSelf(makeNode('parameter', 'string', 'readWrite'))
		const fn = setValue(self, makeEmberClient(), 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1'), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// setValue — String
// ---------------------------------------------------------------------------

describe('setValue String', () => {
	it('calls emberClient.setValue with raw string value', async () => {
		const node = makeNode('parameter', 'string', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'string' as any, 'setValueString' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 'hello', parseEscapeChars: false }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 'hello', false)
	})

	it('calls parseEscapeCharacters when parseEscapeChars is true', async () => {
		const { parseEscapeCharacters } = await import('../util.js')
		const node = makeNode('parameter', 'string', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'string' as any, 'setValueString' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 'hello', parseEscapeChars: true }), ctx)
		expect(parseEscapeCharacters).toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// setValue — Integer
// ---------------------------------------------------------------------------

describe('setValue Integer', () => {
	it('calls emberClient.setValue with factored integer value', async () => {
		const node = makeNode('parameter', 'integer', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const state = makeState({ '0.1': { minimum: 0, maximum: 1000 } })
		const fn = setValue(self, client, 'integer' as any, 'setValueInt' as any, state, makeQueue())
		await fn(makeAction('0.1', { value: 5, factor: '100' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 500, false)
	})

	it('returns without calling setValue when value is NaN', async () => {
		const node = makeNode('parameter', 'integer', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 'not-a-number' }), ctx)
		expect(client.setValue.mock.calls.length).toBe(0)
	})

	it('uses valueVar when useVar is true', async () => {
		const node = makeNode('parameter', 'integer', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { useVar: true, valueVar: '7', factor: '1' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 7, false)
	})
})

// ---------------------------------------------------------------------------
// setValue — Real
// ---------------------------------------------------------------------------

describe('setValue Real', () => {
	it('calls emberClient.setValue with real value', async () => {
		const node = makeNode('parameter', 'real', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'real' as any, 'setValueReal' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 3.14 }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 3.14, false)
	})

	it('returns without calling setValue when value is NaN', async () => {
		const node = makeNode('parameter', 'real', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'real' as any, 'setValueReal' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 'not-a-number' }), ctx)
		expect(client.setValue.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// setValue — Enum
// ---------------------------------------------------------------------------

describe('setValue Enum', () => {
	it('calls emberClient.setValue with numeric enum index', async () => {
		const node = makeNode('parameter', 'enum', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const state = makeState({ '0.1': { minimum: 0, maximum: 3 } })
		const fn = setValue(self, client, 'enum' as any, 'setValueEnum' as any, state, makeQueue())
		await fn(makeAction('0.1', { value: 2 }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 2, false)
	})

	it('asEnum: resolves enum string to index via getEnumIndex', async () => {
		const node = makeNode('parameter', 'enum', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const state = makeState({ '0.1': { minimum: 0, maximum: 3 } })
		state.getEnumIndex.mockReturnValue(1)
		const fn = setValue(self, client, 'enum' as any, 'setValueEnum' as any, state, makeQueue())
		await fn(makeAction('0.1', { asEnum: true, enumValue: 'On' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, 1, false)
	})

	it('asEnum: throws when enum key is not found', async () => {
		const node = makeNode('parameter', 'enum', 'readWrite')
		const self = makeSelf(node)
		const state = makeState({ '0.1': {} })
		state.getEnumIndex.mockReturnValue(undefined)
		const fn = setValue(self, makeEmberClient(), 'enum' as any, 'setValueEnum' as any, state, makeQueue())
		let threw = false
		try {
			await fn(makeAction('0.1', { asEnum: true, enumValue: 'Unknown' }), ctx)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// setValue — Boolean
// ---------------------------------------------------------------------------

describe('setValue Boolean', () => {
	it('calls emberClient.setValue with true', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: true }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, true, false)
	})

	it('toggle: inverts current parameter value', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const state = makeState({ '0.1': { value: true } })
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, state, makeQueue())
		await fn(makeAction('0.1', { toggle: true }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, false, false)
	})

	it('useVar: parses "true" string as true', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { useVar: true, valueVar: 'true' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, true, false)
	})

	it('useVar: parses "false" string as false', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { useVar: true, valueVar: 'false' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, false, false)
	})

	it('useVar: parses "on" as true', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { useVar: true, valueVar: 'on' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, true, false)
	})

	it('useVar: parses "0" as false', async () => {
		const node = makeNode('parameter', 'boolean', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'boolean' as any, 'setValueBoolean' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { useVar: true, valueVar: '0' }), ctx)
		expect(client.setValue).toHaveBeenCalledWith(node, false, false)
	})
})

// ---------------------------------------------------------------------------
// setValue — relative values
// ---------------------------------------------------------------------------

describe('setValue relative', () => {
	it('Integer: calls calcRelativeNumber when relative is true', async () => {
		const { calcRelativeNumber } = await import('../util.js')
		vi.mocked(calcRelativeNumber).mockReturnValue(6)
		const node = makeNode('parameter', 'integer', 'readWrite')
		const self = makeSelf(node)
		const client = makeEmberClient()
		const fn = setValue(self, client, 'integer' as any, 'setValueInt' as any, makeState(), makeQueue())
		await fn(makeAction('0.1', { value: 5, factor: '1', relative: true, min: '0', max: '10' }), ctx)
		expect(calcRelativeNumber).toHaveBeenCalled()
		expect(client.setValue).toHaveBeenCalledWith(node, 6, false)
	})
})
