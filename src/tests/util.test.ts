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
	filterFunctionPathChoices,
	checkNumberLimits,
	calcRelativeNumber,
	resolvePath,
	resolveEventPath,
	sanitiseVariableId,
	isDefined,
	parseBonjourHost,
	hasConnectionChanged,
	isValidHostname,
	isValidPort,
	recordMatrixConnectAction,
	recordParameterAction,
	parseParameterValue,
	parseFunctionArguments,
	discoverFunctionsFromTree,
} from '../util.js'
import { ActionId } from '../actions.js'
import { EmberPlusState } from '../state.js'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../actions', () => ({
	ActionId: {
		SetValueBoolean: 'setValueBoolean',
		SetValueInt: 'setValueInt',
		SetValueReal: 'setValueReal',
		SetValueEnum: 'setValueEnum',
		SetValueString: 'setValueString',
		MatrixConnect: 'matrixConnect',
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
		const choices = filterPathChoices(state, false, EmberModel.ParameterType.Integer)
		expect(choices).toHaveLength(1)
		expect(choices[0].id).toBe('0.1')
		expect(choices[0].label).toContain('gain')
	})

	it('excludes None-access paths when isWriteable=false', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.None)],
		])
		const choices = filterPathChoices(makeState(params), false, EmberModel.ParameterType.Integer)
		expect(choices).toHaveLength(0)
	})

	it('only includes ReadWrite/Write paths when isWriteable=true', () => {
		const params = new Map<string, any>([
			['0.1', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Read)],
			['0.2', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.ReadWrite)],
			['0.3', makeParam(EmberModel.ParameterType.Integer, EmberModel.ParameterAccess.Write)],
		])
		const choices = filterPathChoices(makeState(params), true, EmberModel.ParameterType.Integer)
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
		const choices = filterPathChoices(makeState(params), false, EmberModel.ParameterType.Integer)
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
		const result = calcRelativeNumber(3, '0.1', undefined, undefined, EmberModel.ParameterType.Integer, state)
		expect(result).toBe(8)
	})

	it('rounds result for Integer type', () => {
		const state = makeState(new Map([['0.1', { value: 5.4 }]]))
		const result = calcRelativeNumber(1.3, '0.1', undefined, undefined, EmberModel.ParameterType.Integer, state)
		expect(result).toBe(Math.round(6.7))
	})

	it('enforces min/max limits', () => {
		const state = makeState(new Map([['0.1', { value: 8 }]]))
		const result = calcRelativeNumber(5, '0.1', 0, 10, EmberModel.ParameterType.Integer, state)
		expect(result).toBe(10)
	})

	it('defaults old value to 0 when path missing', () => {
		const state = makeState(new Map())
		const result = calcRelativeNumber(3, 'missing', undefined, undefined, EmberModel.ParameterType.Real, state)
		expect(result).toBe(3)
	})

	it('enforces limits given as the ends of a range', () => {
		const state = makeState(new Map([['0.1', { value: 8 }]]))
		const result = calcRelativeNumber(-20, '0.1', Number.MIN_SAFE_INTEGER, 10, EmberModel.ParameterType.Integer, state)
		expect(result).toBe(-12)
	})

	it('clamps Enum type to minimum of 0', () => {
		const state = makeState(new Map([['0.1', { value: 0 }]]))
		const result = calcRelativeNumber(-5, '0.1', undefined, undefined, EmberModel.ParameterType.Enum, state)
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
		expect(resolvePath(']0.1[')).toBe(']0.1[')
	})

	describe('valid numeric ember+ paths in brackets', () => {
		it('extracts a single segment path', () => {
			expect(resolvePath('node[0]')).toBe('0')
		})
		it('extracts a two segment path', () => {
			expect(resolvePath('node[0.1]')).toBe('0.1')
		})
		it('extracts a deeply nested path', () => {
			expect(resolvePath('node[0.1.2.3.4]')).toBe('0.1.2.3.4')
		})
		it('extracts path with multi-digit segments', () => {
			expect(resolvePath('node[12.345.6]')).toBe('12.345.6')
		})
		it('replaces slashes before extracting bracket content', () => {
			expect(resolvePath('node/path[0.1.2]')).toBe('0.1.2')
		})
	})

	describe('invalid numeric ember+ paths in brackets', () => {
		it('returns full path when bracket content is empty', () => {
			expect(resolvePath('node[]')).toBe('node[]')
		})
		it('returns full path when bracket content is a label string', () => {
			expect(resolvePath('node[gain.value]')).toBe('node[gain.value]')
		})
		it('returns full path when bracket content has a trailing dot', () => {
			expect(resolvePath('node[0.1.]')).toBe('node[0.1.]')
		})
		it('returns full path when bracket content has a leading dot', () => {
			expect(resolvePath('node[.0.1]')).toBe('node[.0.1]')
		})
		it('returns full path when bracket content has consecutive dots', () => {
			expect(resolvePath('node[0..1]')).toBe('node[0..1]')
		})
		it('returns full path when bracket content contains letters mixed with numbers', () => {
			expect(resolvePath('node[0.1a.2]')).toBe('node[0.1a.2]')
		})
		it('returns full path when bracket content contains slashes', () => {
			expect(resolvePath('node[0/1/2]')).toBe('0.1.2') // slashes are replaced first → becomes 'node[0.1.2]' → valid
		})
	})
})

// ---------------------------------------------------------------------------
// resolveEventPath
// ---------------------------------------------------------------------------

describe('resolveEventPath', () => {
	it('uses the path option', () => {
		expect(resolveEventPath({ options: { path: '0.1.2' } })).toBe('0.1.2')
	})
	it('resolves the path as resolvePath does', () => {
		expect(resolveEventPath({ options: { path: 'Gain [1/2/3]' } })).toBe('1.2.3')
	})
	it('reads a number an expression returned as a path', () => {
		expect(resolveEventPath({ options: { path: 7 as unknown as string } })).toBe('7')
	})
	it('handles missing path gracefully', () => {
		expect(resolveEventPath({ options: {} })).toBe('')
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
// isValidHostname / isValidPort
// ---------------------------------------------------------------------------

describe('isValidHostname', () => {
	it('accepts a hostname', () => {
		expect(isValidHostname('ember-provider')).toBe(true)
	})
	it('accepts a fully qualified domain name', () => {
		expect(isValidHostname('ember.provider.example.com')).toBe(true)
	})
	it('accepts an IPv4 address', () => {
		expect(isValidHostname('192.168.0.1')).toBe(true)
	})
	it('rejects a hostname containing illegal characters', () => {
		expect(isValidHostname('bad host!')).toBe(false)
	})
	it('rejects a hostname with a port appended', () => {
		expect(isValidHostname('10.0.0.1:9000')).toBe(false)
	})
	it('rejects an empty string', () => {
		expect(isValidHostname('')).toBe(false)
	})
})

describe('isValidPort', () => {
	it('accepts the lowest port', () => {
		expect(isValidPort(1)).toBe(true)
	})
	it('accepts the highest port', () => {
		expect(isValidPort(65535)).toBe(true)
	})
	it('rejects zero', () => {
		expect(isValidPort(0)).toBe(false)
	})
	it('rejects ports above the valid range', () => {
		expect(isValidPort(70000)).toBe(false)
	})
	it('rejects non integers', () => {
		expect(isValidPort(9000.5)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// recordMatrixConnectAction
// ---------------------------------------------------------------------------

describe('recordMatrixConnectAction', () => {
	function matrixInfo(type: EmberModel.MatrixType) {
		const matrix = new EmberModel.MatrixImpl('router')
		matrix.matrixType = type
		return {
			path: '1.4',
			key: '1_4',
			node: new EmberModel.NumberedTreeNodeImpl(4, matrix),
			connectionsLoaded: true,
			labels: { targets: new Map(), sources: new Map() },
		}
	}

	it("records a 1:N matrix's target's source, once per target", () => {
		const instance = makeInstance()
		recordMatrixConnectAction(instance, matrixInfo(EmberModel.MatrixType.OneToN), 2, [5])
		expect(instance.recordAction).toHaveBeenCalledWith(
			{ actionId: 'matrixConnect', options: { matrix: '1.4', target_1_4: 2, sources_1_4: 5 } },
			'1.4:2',
		)
	})

	it("records an N:N matrix's target's sources as a list", () => {
		const instance = makeInstance()
		recordMatrixConnectAction(instance, matrixInfo(EmberModel.MatrixType.NToN), 2, [3, 7])
		expect(instance.recordAction).toHaveBeenCalledWith(
			{ actionId: 'matrixConnect', options: { matrix: '1.4', target_1_4: 2, sources_1_4: [3, 7] } },
			'1.4:2',
		)
	})

	// Matrix Connect has no source to connect
	it('records nothing for a target left with no source', () => {
		const instance = makeInstance()
		recordMatrixConnectAction(instance, matrixInfo(EmberModel.MatrixType.NToN), 2, [])
		expect(instance.recordAction).not.toHaveBeenCalled()
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
		expect(call.options.min).toBe(0)
		expect(call.options.max).toBe(100)
		expect(call.options).not.toHaveProperty('factor')
	})

	// The action takes a number as displayed, and converts it with the parameter's formula or factor
	it.each([
		[ActionId.SetValueInt, { parameterType: EmberModel.ParameterType.Integer, value: 500, factor: 100 }, 5],
		[ActionId.SetValueReal, { parameterType: EmberModel.ParameterType.Real, value: 2, formula: '$ * 10\n$ / 10' }, 20],
	])('records %s with the value as displayed', (actionId, parameter, displayed) => {
		const instance = makeInstance()
		recordParameterAction('0.1', actionId, 0, instance, makeState(new Map([['0.1', parameter]])))
		expect(instance.recordAction.mock.calls[0][0].options.value).toBe(displayed)
	})

	// The limits are numbers now, so a parameter without them gets the ends of the range Ember+ allows its type:
	// no limit, as an empty text limit was. A null limit (Glow: none) is none too
	it.each([
		[ActionId.SetValueInt, { minimum: null }, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
		[ActionId.SetValueReal, {}, -Number.MAX_VALUE, Number.MAX_VALUE],
		[ActionId.SetValueEnum, {}, 0, Number.MAX_SAFE_INTEGER],
	])('records %s without parameter limits as the whole range', (actionId, parameter, min, max) => {
		const instance = makeInstance()
		recordParameterAction('0.1', actionId, 1, instance, makeState(new Map([['0.1', parameter]])))
		const { options } = instance.recordAction.mock.calls[0][0]
		expect(options).toMatchObject({ min, max, relative: false })
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
		const result = parseParameterValue({ parameterType: EmberModel.ParameterType.Boolean, value: true } as any)
		expect(result).toEqual({ actionType: ActionId.SetValueBoolean, value: true })
	})

	// The recorder gives the action the displayed value, by the library's displayValue (recordParameterAction)
	it('parses Integer parameter as the device has it, factor or not', () => {
		const result = parseParameterValue({
			parameterType: EmberModel.ParameterType.Integer,
			value: 100,
			factor: 2,
		} as any)
		expect(result).toEqual({ actionType: ActionId.SetValueInt, value: 100 })
	})

	it('parses Real parameter', () => {
		const result = parseParameterValue({ parameterType: EmberModel.ParameterType.Real, value: 3.14 } as any)
		expect(result).toEqual({ actionType: ActionId.SetValueReal, value: 3.14 })
	})

	it('parses Enum parameter', () => {
		const result = parseParameterValue({ parameterType: EmberModel.ParameterType.Enum, value: 2 } as any)
		expect(result).toEqual({ actionType: ActionId.SetValueEnum, value: 2 })
	})

	it('parses String parameter and substitutes escape characters', () => {
		const result = parseParameterValue({
			parameterType: EmberModel.ParameterType.String,
			value: 'line1\nline2',
		} as any)
		expect(result.actionType).toBe(ActionId.SetValueString)
		expect(result.value).toBe('line1\\nline2')
	})

	it('gives a parameter of another type no action', () => {
		const result = parseParameterValue({ parameterType: EmberModel.ParameterType.Octets, value: null } as any)
		expect(result).toEqual({ actionType: undefined, value: null })
	})

	// Glow 2.50: a null value means none at present, and keeps the parameter's type (library 0.5.0). The string
	// case threw on one, and the integer case gave NaN
	it.each([
		[EmberModel.ParameterType.Boolean, ActionId.SetValueBoolean],
		[EmberModel.ParameterType.Integer, ActionId.SetValueInt],
		[EmberModel.ParameterType.Real, ActionId.SetValueReal],
		[EmberModel.ParameterType.Enum, ActionId.SetValueEnum],
		[EmberModel.ParameterType.String, ActionId.SetValueString],
	])('reads a null %s value as null', (parameterType, actionType) => {
		const result = parseParameterValue(
			new EmberModel.ParameterImpl(parameterType, undefined, undefined, null) as EmberModel.Parameter,
		)
		expect(result).toEqual({ actionType, value: null })
	})
})

// ---------------------------------------------------------------------------
// filterFunctionPathChoices
// ---------------------------------------------------------------------------

describe('filterFunctionPathChoices', () => {
	it('returns formatted choices for registered functions', () => {
		const mockState: any = {
			functions: new Map([
				['1.2.3', { identifier: 'Mute', description: 'Mute Channel' }],
				['1.2.4', { identifier: 'Unmute' }],
				['1.2.5', {}],
			]),
		}

		const choices = filterFunctionPathChoices(mockState)
		expect(choices).toEqual([
			{ id: '1.2.3', label: '1.2.3: Mute (Mute Channel)' },
			{ id: '1.2.4', label: '1.2.4: Unmute' },
			{ id: '1.2.5', label: '1.2.5' },
		])
	})

	it('returns empty array when no functions are registered', () => {
		const mockState: any = { functions: new Map() }
		expect(filterFunctionPathChoices(mockState)).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// parseFunctionArguments
// ---------------------------------------------------------------------------

describe('parseFunctionArguments', () => {
	it('returns empty array for empty input', () => {
		expect(parseFunctionArguments('')).toEqual([])
		expect(parseFunctionArguments('   ')).toEqual([])
	})

	it('parses and casts comma-separated arguments matching expected schema', () => {
		const expectedArgs: any[] = [
			{ type: EmberModel.ParameterType.Integer, name: 'id' },
			{ type: EmberModel.ParameterType.Real, name: 'gain' },
			{ type: EmberModel.ParameterType.Boolean, name: 'state' },
			{ type: EmberModel.ParameterType.String, name: 'name' },
		]

		const result = parseFunctionArguments('42, 3.14, true, Hello World', expectedArgs)
		expect(result).toEqual([
			{ type: EmberModel.ParameterType.Integer, value: 42 },
			{ type: EmberModel.ParameterType.Real, value: 3.14 },
			{ type: EmberModel.ParameterType.Boolean, value: true },
			{ type: EmberModel.ParameterType.String, value: 'Hello World' },
		])
	})

	it('infers parameter types when no schema is provided', () => {
		const result = parseFunctionArguments('true, 100, 2.5, sample')
		expect(result).toEqual([
			{ type: EmberModel.ParameterType.Boolean, value: true },
			{ type: EmberModel.ParameterType.Integer, value: 100 },
			{ type: EmberModel.ParameterType.Real, value: 2.5 },
			{ type: EmberModel.ParameterType.String, value: 'sample' },
		])
	})

	it('parses JSON array format correctly', () => {
		const result = parseFunctionArguments('[1, "abc", false]')
		expect(result).toEqual([
			{ type: EmberModel.ParameterType.Integer, value: 1 },
			{ type: EmberModel.ParameterType.String, value: 'abc' },
			{ type: EmberModel.ParameterType.Boolean, value: false },
		])
	})

	it('passes through explicit typed objects in JSON array', () => {
		const result = parseFunctionArguments('[{"type": "INTEGER", "value": 55}]')
		expect(result).toEqual([{ type: EmberModel.ParameterType.Integer, value: 55 }])
	})

	// The library refuses a value that doesn't fit its type, so such an object is no typed value: it goes as text
	it('does not pass through a typed object whose value does not fit its type', () => {
		const result = parseFunctionArguments('[{"type": "INTEGER", "value": "x"}]')
		expect(result).toEqual([{ type: EmberModel.ParameterType.String, value: '{"type":"INTEGER","value":"x"}' }])
	})

	it.each([
		[EmberModel.ParameterType.Octets, '"ab"', Buffer.from('ab')],
		[EmberModel.ParameterType.Null, '"ab"', null],
		[EmberModel.ParameterType.Trigger, '7', 7],
	])('gives a %s argument a value of its form', (type, json, value) => {
		const result = parseFunctionArguments(`[${json}]`, [new EmberModel.FunctionArgumentImpl(type)])
		expect(result).toEqual([{ type, value }])
	})

	it.each([
		[EmberModel.ParameterType.Octets, Buffer.from('ab')],
		[EmberModel.ParameterType.Null, null],
		[EmberModel.ParameterType.Trigger, 'ab'],
	])('gives a %s argument in a list a value of its form', (type, value) => {
		const result = parseFunctionArguments('ab', [new EmberModel.FunctionArgumentImpl(type)])
		expect(result).toEqual([{ type, value }])
	})
})

// ---------------------------------------------------------------------------
// discoverFunctionsFromTree
// ---------------------------------------------------------------------------

describe('discoverFunctionsFromTree', () => {
	it('recursively discovers function nodes in tree', () => {
		const state = new EmberPlusState()
		// The client's tree and an element's children are Maps by number
		const tree = EmberModel.childrenOf([
			new EmberModel.NumberedTreeNodeImpl(
				1,
				new EmberModel.EmberNodeImpl(),
				EmberModel.childrenOf([
					new EmberModel.NumberedTreeNodeImpl(2, new EmberModel.EmberFunctionImpl('TestFunc')),
					new EmberModel.NumberedTreeNodeImpl(3, new EmberModel.ParameterImpl(EmberModel.ParameterType.Integer)),
				]),
			),
		])

		discoverFunctionsFromTree(tree, state)
		expect(state.hasFunction('1.2')).toBe(true)
		expect(state.getFunction('1.2')?.identifier).toBe('TestFunc')
		expect(state.hasFunction('1.3')).toBe(false)
	})

	it.each([
		['undefined', undefined],
		['empty', new Map()],
	])('handles %s tree gracefully', (_label, tree) => {
		const state = new EmberPlusState()
		discoverFunctionsFromTree(tree, state)
		expect(state.functions.size).toBe(0)
	})
})
