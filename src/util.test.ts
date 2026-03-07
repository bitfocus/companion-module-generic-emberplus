import { describe, it, expect, vi } from 'vitest'
import {
	assertUnreachable,
	literal,
	compareNumber,
	NumberComparitor,
	comparitorOptions,
	parseEscapeCharacters,
	substituteEscapeCharacters,
	filterPathChoices,
	checkNumberLimits,
	calcRelativeNumber,
	resolvePath,
	resolveEventPath,
	sanitiseVariableId,
	isDefined,
	parseBonjourHost,
	hasConnectionChanged,
	recordParameterAction,
	parseParameterValue,
} from './util.js'
import { ActionId } from './actions.js'
import { EmberPlusState } from './state.js'
import { Model as EmberModel } from 'emberplus-connection'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('emberplus-connection', () => ({
	Model: {
		ParameterType: {
			Boolean: 'boolean',
			Integer: 'integer',
			Real: 'real',
			Enum: 'enum',
			String: 'string',
		},
		ParameterAccess: {
			None: 'none',
			Read: 'read',
			Write: 'write',
			ReadWrite: 'readWrite',
		},
	},
}))

vi.mock('./actions', () => ({
	ActionId: {
		SetValueBoolean: 'setValueBoolean',
		SetValueInt: 'setValueInt',
		SetValueReal: 'setValueReal',
		SetValueEnum: 'setValueEnum',
		SetValueString: 'setValueString',
	},
}))

// Minimal EmberPlusState mock factory
function makeState(params: Map<string, any> = new Map()): EmberPlusState {
	return {
		parameters: params,
		getCurrentEnumValue: vi.fn().mockReturnValue('enumLabel'),
	} as unknown as EmberPlusState
}

// Minimal EmberPlusInstance mock
function makeInstance() {
	return { recordAction: vi.fn() } as any
}

// ---------------------------------------------------------------------------
// literal
// ---------------------------------------------------------------------------

describe('literal', () => {
	it('returns the value unchanged', () => {
		expect(literal(42)).toBe(42)
		expect(literal('hello')).toBe('hello')
		expect(literal({ a: 1 })).toEqual({ a: 1 })
	})
})

// ---------------------------------------------------------------------------
// assertUnreachable
// ---------------------------------------------------------------------------

describe('assertUnreachable', () => {
	it('does not throw (no-op implementation)', () => {
		// If this throws, vitest will fail the test automatically
		assertUnreachable(undefined as never)
	})
})

// ---------------------------------------------------------------------------
// compareNumber
// ---------------------------------------------------------------------------

describe('compareNumber', () => {
	it('Equal: returns true when values match', () => {
		expect(compareNumber(5, NumberComparitor.Equal, 5)).toBe(true)
	})
	it('Equal: returns false when values differ', () => {
		expect(compareNumber(5, NumberComparitor.Equal, 6)).toBe(false)
	})
	it('NotEqual: returns true when values differ', () => {
		expect(compareNumber(5, NumberComparitor.NotEqual, 6)).toBe(true)
	})
	it('NotEqual: returns false when values match', () => {
		expect(compareNumber(5, NumberComparitor.NotEqual, 5)).toBe(false)
	})
	it('LessThan: currentValue < target', () => {
		expect(compareNumber(10, NumberComparitor.LessThan, 5)).toBe(true)
		expect(compareNumber(10, NumberComparitor.LessThan, 10)).toBe(false)
	})
	it('LessThanEqual: currentValue <= target', () => {
		expect(compareNumber(10, NumberComparitor.LessThanEqual, 10)).toBe(true)
		expect(compareNumber(10, NumberComparitor.LessThanEqual, 11)).toBe(false)
	})
	it('GreaterThan: currentValue > target', () => {
		expect(compareNumber(5, NumberComparitor.GreaterThan, 10)).toBe(true)
		expect(compareNumber(10, NumberComparitor.GreaterThan, 10)).toBe(false)
	})
	it('GreaterThanEqual: currentValue >= target', () => {
		expect(compareNumber(5, NumberComparitor.GreaterThanEqual, 5)).toBe(true)
		expect(compareNumber(5, NumberComparitor.GreaterThanEqual, 4)).toBe(false)
	})
	it('returns false when target is NaN', () => {
		expect(compareNumber(NaN, NumberComparitor.Equal, 5)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// comparitorOptions
// ---------------------------------------------------------------------------

describe('comparitorOptions', () => {
	it('contains all 6 comparitor entries', () => {
		expect(comparitorOptions).toHaveLength(6)
	})
	it('each entry has id and label', () => {
		comparitorOptions.forEach((opt) => {
			expect(opt).toHaveProperty('id')
			expect(opt).toHaveProperty('label')
		})
	})
})

// ---------------------------------------------------------------------------
// parseEscapeCharacters
// ---------------------------------------------------------------------------

describe('parseEscapeCharacters', () => {
	it('converts \\n to newline', () => {
		expect(parseEscapeCharacters('line1\\nline2')).toBe('line1\nline2')
	})
	it('converts \\r, \\t, \\f, \\v, \\b', () => {
		expect(parseEscapeCharacters('\\r')).toBe('\r')
		expect(parseEscapeCharacters('\\t')).toBe('\t')
		expect(parseEscapeCharacters('\\f')).toBe('\f')
		expect(parseEscapeCharacters('\\v')).toBe('\v')
		expect(parseEscapeCharacters('\\b')).toBe('\b')
	})
	it('converts \\x00 – \\x03 to control characters', () => {
		expect(parseEscapeCharacters('\\x00')).toBe('\x00')
		expect(parseEscapeCharacters('\\x03')).toBe('\x03')
	})
	it('leaves regular strings unchanged', () => {
		expect(parseEscapeCharacters('hello world')).toBe('hello world')
	})
})

// ---------------------------------------------------------------------------
// substituteEscapeCharacters
// ---------------------------------------------------------------------------

describe('substituteEscapeCharacters', () => {
	it('is the inverse of parseEscapeCharacters for supported sequences', () => {
		const original = 'a\nb\tc\rd'
		const substituted = substituteEscapeCharacters(original)
		expect(substituted).toBe('a\\nb\\tc\\rd')
		expect(parseEscapeCharacters(substituted)).toBe(original)
	})
	it('converts control characters back to escape sequences', () => {
		expect(substituteEscapeCharacters('\x00')).toBe('\\x00')
		expect(substituteEscapeCharacters('\x03')).toBe('\\x03')
	})
})

// ---------------------------------------------------------------------------
// filterPathChoices
// ---------------------------------------------------------------------------

describe('filterPathChoices', () => {
	const makeParam = (parameterType: string, access: string, identifier?: string, description?: string) => ({
		parameterType,
		access,
		identifier,
		description,
	})

	it('returns readable choices when isWriteable=false', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Read, 'gain')],
		])
		const state = makeState(params)
		const choices = filterPathChoices(state, false, EmberModel.ParameterType.Integer as any)
		expect(choices).toHaveLength(1)
		expect(choices[0].id).toBe('0.1')
		expect(choices[0].label).toContain('gain')
	})

	it('excludes None-access paths when isWriteable=false', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.None)],
		])
		const choices = filterPathChoices(makeState(params), false, EmberModel.ParameterType.Integer as any)
		expect(choices).toHaveLength(0)
	})

	it('only includes ReadWrite/Write paths when isWriteable=true', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Read)],
			['0.2', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.ReadWrite)],
			['0.3', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Write)],
		])
		const choices = filterPathChoices(makeState(params), true, EmberModel.ParameterType.Integer as any)
		expect(choices).toHaveLength(2)
		expect(choices.map((c) => c.id)).toEqual(expect.arrayContaining(['0.2', '0.3']))
	})

	it('returns all types when no filter specified', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Read)],
			['0.2', makeParam(EmberModel.ParameterType.Boolean, EmberModel.ParameterAccess.Read)],
		])
		const choices = filterPathChoices(makeState(params), false)
		expect(choices).toHaveLength(2)
	})

	it('appends description in parentheses when present', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Read, 'id', 'my desc')],
		])
		const choices = filterPathChoices(makeState(params), false, EmberModel.ParameterType.Integer as any)
		expect(choices[0].label).toContain('(my desc)')
	})
})

// ---------------------------------------------------------------------------
// checkNumberLimits
// ---------------------------------------------------------------------------

describe('checkNumberLimits', () => {
	it('returns value when within range', () => {
		expect(checkNumberLimits(5, 0, 10)).toBe(5)
	})
	it('clamps to min', () => {
		expect(checkNumberLimits(-5, 0, 10)).toBe(0)
	})
	it('clamps to max', () => {
		expect(checkNumberLimits(15, 0, 10)).toBe(10)
	})
	it('handles boundary values', () => {
		expect(checkNumberLimits(0, 0, 10)).toBe(0)
		expect(checkNumberLimits(10, 0, 10)).toBe(10)
	})
})

// ---------------------------------------------------------------------------
// calcRelativeNumber
// ---------------------------------------------------------------------------

describe('calcRelativeNumber', () => {
	it('adds relative value to current state value', () => {
		const state = makeState(new Map([['0.1', { value: 5 }]]))
		const result = calcRelativeNumber(3, '0.1', '', '', EmberModel.ParameterType.Integer as any, state)
		expect(result).toBe(8)
	})

	it('rounds result for Integer type', () => {
		const state = makeState(new Map([['0.1', { value: 5.4 }]]))
		const result = calcRelativeNumber(1.3, '0.1', '', '', EmberModel.ParameterType.Integer as any, state)
		expect(result).toBe(Math.round(6.7))
	})

	it('enforces min/max limits', () => {
		const state = makeState(new Map([['0.1', { value: 8 }]]))
		const result = calcRelativeNumber(5, '0.1', '0', '10', EmberModel.ParameterType.Integer as any, state)
		expect(result).toBe(10)
	})

	it('defaults old value to 0 when path missing', () => {
		const state = makeState(new Map())
		const result = calcRelativeNumber(3, 'missing', '', '', EmberModel.ParameterType.Real as any, state)
		expect(result).toBe(3)
	})

	it('clamps Enum type to minimum of 0', () => {
		const state = makeState(new Map([['0.1', { value: 0 }]]))
		const result = calcRelativeNumber(-5, '0.1', '', '', EmberModel.ParameterType.Enum as any, state)
		expect(result).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------

describe('resolvePath', () => {
	it('replaces slashes with dots and trims', () => {
		expect(resolvePath('0/1/2')).toBe('0.1.2')
	})
	it('extracts content inside last brackets', () => {
		expect(resolvePath('node[0.1.2]')).toBe('0.1.2')
	})
	it('returns dotted path when no brackets', () => {
		expect(resolvePath('0.1.2')).toBe('0.1.2')
	})
	it('uses last bracket pair when multiple exist', () => {
		expect(resolvePath('[0.1][0.2.3]')).toBe('0.2.3')
	})
	it('ignores brackets when close comes before open', () => {
		// close before open → no valid bracket pair → returns dotted path
		expect(resolvePath(']0.1[')).toBe(']0.1[')
	})
})

// ---------------------------------------------------------------------------
// resolveEventPath
// ---------------------------------------------------------------------------

describe('resolveEventPath', () => {
	it('uses path when usePathVar is false', () => {
		const event = { options: { usePathVar: false, path: '0.1.2', pathVar: 'var.path' } } as any
		expect(resolveEventPath(event)).toBe('0.1.2')
	})
	it('uses pathVar when usePathVar is true', () => {
		const event = { options: { usePathVar: true, path: '0.1.2', pathVar: 'var.path' } } as any
		expect(resolveEventPath(event)).toBe('var.path')
	})
	it('handles missing path gracefully', () => {
		const event = { options: { usePathVar: false } } as any
		expect(resolveEventPath(event)).toBe('')
	})
})

// ---------------------------------------------------------------------------
// sanitiseVariableId
// ---------------------------------------------------------------------------

describe('sanitiseVariableId', () => {
	it('replaces illegal characters with underscore by default', () => {
		expect(sanitiseVariableId('my var!')).toBe('my_var_')
	})
	it('allows alphanumerics, hyphens, underscores, dots', () => {
		expect(sanitiseVariableId('my-var_1.2')).toBe('my-var_1.2')
	})
	it('uses specified substitute character', () => {
		expect(sanitiseVariableId('my var', '-')).toBe('my-var')
	})
	it('removes illegal chars when substitute is empty string', () => {
		expect(sanitiseVariableId('my var!', '')).toBe('myvar')
	})
})

// ---------------------------------------------------------------------------
// isDefined
// ---------------------------------------------------------------------------

describe('isDefined', () => {
	it('returns true for defined values', () => {
		expect(isDefined(0)).toBe(true)
		expect(isDefined('')).toBe(true)
		expect(isDefined(false)).toBe(true)
		expect(isDefined({})).toBe(true)
	})
	it('returns false for null', () => {
		expect(isDefined(null)).toBe(false)
	})
	it('returns false for undefined', () => {
		expect(isDefined(undefined)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// parseBonjourHost
// ---------------------------------------------------------------------------

describe('parseBonjourHost', () => {
	it('returns host and port from config when no bonjourHost', () => {
		const config = { host: '192.168.1.1', port: 8080 } as any
		expect(parseBonjourHost(config)).toEqual(['192.168.1.1', 8080])
	})
	it('parses host and port from bonjourHost string', () => {
		const config = { bonjourHost: '10.0.0.1:9001' } as any
		expect(parseBonjourHost(config)).toEqual(['10.0.0.1', 9001])
	})
	it('defaults to port 9000 when bonjourHost port is missing/invalid', () => {
		const config = { bonjourHost: '10.0.0.1:abc' } as any
		expect(parseBonjourHost(config)).toEqual(['10.0.0.1', 9000])
	})
	it('defaults host to empty string and port to 9000 when nothing provided', () => {
		const config = {} as any
		expect(parseBonjourHost(config)).toEqual(['', 9000])
	})
})

// ---------------------------------------------------------------------------
// hasConnectionChanged
// ---------------------------------------------------------------------------

describe('hasConnectionChanged', () => {
	it('returns true when host changed', () => {
		expect(hasConnectionChanged({ host: 'a', port: 9000 } as any, { host: 'b', port: 9000 } as any)).toBe(true)
	})
	it('returns true when port changed', () => {
		expect(hasConnectionChanged({ host: 'a', port: 9000 } as any, { host: 'a', port: 9001 } as any)).toBe(true)
	})
	it('returns false when neither changed', () => {
		expect(hasConnectionChanged({ host: 'a', port: 9000 } as any, { host: 'a', port: 9000 } as any)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// recordParameterAction
// ---------------------------------------------------------------------------

describe('recordParameterAction', () => {
	it('records a boolean action', () => {
		const instance = makeInstance()
		const state = makeState(new Map())
		recordParameterAction('0.1', ActionId.SetValueBoolean, true, instance, state)
		expect(instance.recordAction).toHaveBeenCalledWith(
			expect.objectContaining({ actionId: ActionId.SetValueBoolean }),
			'0.1',
		)
	})

	it('records an integer action with min/max from state', () => {
		const instance = makeInstance()
		const state = makeState(new Map([['0.1', { minimum: 0, maximum: 100, factor: 2 }]]))
		recordParameterAction('0.1', ActionId.SetValueInt, 50, instance, state)
		const call = instance.recordAction.mock.calls[0][0]
		expect(call.options.min).toBe('0')
		expect(call.options.max).toBe('100')
		expect(call.options.factor).toBe('2')
	})

	it('records a real action', () => {
		const instance = makeInstance()
		recordParameterAction('0.1', ActionId.SetValueReal, 3.14, instance, makeState())
		expect(instance.recordAction).toHaveBeenCalledWith(
			expect.objectContaining({ actionId: ActionId.SetValueReal }),
			'0.1',
		)
	})

	it('records an enum action', () => {
		const instance = makeInstance()
		const state = makeState(new Map([['0.1', { minimum: 0, maximum: 5 }]]))
		recordParameterAction('0.1', ActionId.SetValueEnum, 2, instance, state)
		const call = instance.recordAction.mock.calls[0][0]
		expect(call.options.asEnum).toBe(true)
	})

	it('records a string action', () => {
		const instance = makeInstance()
		recordParameterAction('0.1', ActionId.SetValueString, 'hello', instance, makeState())
		const call = instance.recordAction.mock.calls[0][0]
		expect(call.options.parseEscapeChars).toBe(false)
	})

	it('does nothing for unknown action type', () => {
		const instance = makeInstance()
		recordParameterAction('0.1', 'unknown' as any, 0, instance, makeState())
		expect(instance.recordAction.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// parseParameterValue
// ---------------------------------------------------------------------------

describe('parseParameterValue', () => {
	it('parses Boolean parameter', () => {
		const state = makeState()
		const result = parseParameterValue(
			'0.1',
			{ parameterType: EmberModel.ParameterType.Boolean, value: true } as any,
			state,
		)
		expect(result).toEqual({ actionType: ActionId.SetValueBoolean, value: true })
	})

	it('parses Integer parameter and divides by factor', () => {
		const state = makeState(new Map([['0.1', { factor: 2 }]]))
		const result = parseParameterValue(
			'0.1',
			{ parameterType: EmberModel.ParameterType.Integer, value: 100 } as any,
			state,
		)
		expect(result).toEqual({ actionType: ActionId.SetValueInt, value: 50 })
	})

	it('defaults to factor 1 when param missing', () => {
		const state = makeState()
		const result = parseParameterValue(
			'0.1',
			{ parameterType: EmberModel.ParameterType.Integer, value: 100 } as any,
			state,
		)
		expect(result.value).toBe(100)
	})

	it('parses Real parameter', () => {
		const state = makeState()
		const result = parseParameterValue(
			'0.1',
			{ parameterType: EmberModel.ParameterType.Real, value: 3.14 } as any,
			state,
		)
		expect(result).toEqual({ actionType: ActionId.SetValueReal, value: 3.14 })
	})

	it('parses Enum parameter', () => {
		const state = makeState()
		const result = parseParameterValue('0.1', { parameterType: EmberModel.ParameterType.Enum, value: 2 } as any, state)
		expect(result).toEqual({ actionType: ActionId.SetValueEnum, value: 2 })
	})

	it('parses String parameter and substitutes escape characters', () => {
		const state = makeState()
		const result = parseParameterValue(
			'0.1',
			{ parameterType: EmberModel.ParameterType.String, value: 'line1\nline2' } as any,
			state,
		)
		expect(result.actionType).toBe(ActionId.SetValueString)
		expect(result.value).toBe('line1\\nline2')
	})

	it('handles unknown parameter type', () => {
		const state = makeState()
		const result = parseParameterValue('0.1', { parameterType: 'unknown', value: 'raw' } as any, state)
		expect(result.actionType).toBeUndefined()
		expect(result.value).toBe('raw')
	})
})
