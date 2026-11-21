import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { GetVariablesList, hasParameterVariables, parameterVariableValue } from '../variables.js'
import { EmberPlusState } from '../state.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other tests do
vi.mock('../actions.js', () => ({ ActionId: {} }))

const { ElementType, ParameterType } = EmberModel

function parameter(fields: Record<string, unknown>): EmberModel.Parameter {
	return { type: ElementType.Parameter, parameterType: ParameterType.Integer, ...fields }
}

/** Monitored parameters at the paths given, a stream when it has a stream identifier */
function stateWith(...paths: Array<[string, Record<string, unknown>]>): EmberPlusState {
	const state = new EmberPlusState()
	for (const [path, fields] of paths) {
		state.monitoredParameters.add(path)
		state.updateParameterMap(path, { number: 1, contents: parameter({ identifier: 'gain', ...fields }) } as never)
	}
	return state
}

const level: [string, Record<string, unknown>] = ['1.2', {}]
const mode: [string, Record<string, unknown>] = ['1.3', { parameterType: ParameterType.Enum }]
const meter: [string, Record<string, unknown>] = ['1.4', { streamIdentifier: 7 }]

describe('GetVariablesList', () => {
	it('defines a variable per monitored parameter, and an _ENUM one for an enum, with parameter values on', () => {
		const variables = GetVariablesList(stateWith(level, mode), { values: true, streams: false })
		expect(Object.keys(variables)).toEqual(['host', 'port', '1.2', '1.3', '1.3_ENUM'])
		expect(variables['1.2']).toEqual({ name: '1.2: gain' })
	})

	// Without Parameter - Values or Streams in Connection Variables, the Parameter Property feedback gives the value
	it('defines only the host and port with neither on', () => {
		const variables = GetVariablesList(stateWith(level, meter), { values: false, streams: false })
		expect(Object.keys(variables)).toEqual(['host', 'port'])
	})

	// Meters update many times a second, so their variables are a choice of their own
	it('defines stream parameters only with parameter streams on', () => {
		expect(Object.keys(GetVariablesList(stateWith(level, meter), { values: true, streams: false }))).toEqual([
			'host',
			'port',
			'1.2',
		])
		expect(Object.keys(GetVariablesList(stateWith(level, meter), { values: false, streams: true }))).toEqual([
			'host',
			'port',
			'1.4',
		])
	})

	it('counts a monitored path not yet loaded as no stream', () => {
		const state = new EmberPlusState()
		state.monitoredParameters.add('1.9')
		expect(Object.keys(GetVariablesList(state, { values: true, streams: false }))).toContain('1.9')
	})
})

describe('hasParameterVariables', () => {
	it.each([
		[{}, { values: true, streams: false }, true],
		[{}, { values: false, streams: true }, false],
		[{ streamIdentifier: 0 }, { values: true, streams: false }, false],
		[{ streamIdentifier: 0 }, { values: false, streams: true }, true],
	])('for %j with %j: %j', (fields, kinds, expected) => {
		expect(hasParameterVariables(parameter(fields), kinds)).toBe(expected)
	})
})

describe('parameterVariableValue', () => {
	// Apply Formula and Factor to Parameter Variables
	it('gives an integer divided by its factor, displayed', () => {
		expect(parameterVariableValue(parameter({ value: 500, factor: 100 }), true)).toBe(5)
	})

	it('gives a value by its formula, displayed, before any factor', () => {
		const withFormula = parameter({ parameterType: ParameterType.Real, value: 2, formula: '$ * 10\n$ / 10', factor: 4 })
		expect(parameterVariableValue(withFormula, true)).toBe(20)
	})

	it("gives the device's value, not displayed", () => {
		expect(parameterVariableValue(parameter({ value: 500, factor: 100, formula: '$ * 2\n$ / 2' }), false)).toBe(500)
	})

	it("gives the device's value for a formula that can't be computed", () => {
		expect(parameterVariableValue(parameter({ value: 5, formula: '$ +' }), true)).toBe(5)
	})

	it('gives an enumeration its value, the entry number', () => {
		const enumerated = parameter({ parameterType: ParameterType.Enum, value: 1, enumeration: 'Off\nOn' })
		expect(parameterVariableValue(enumerated, true)).toBe(1)
	})

	it('writes out the control characters of a string', () => {
		expect(parameterVariableValue(parameter({ parameterType: ParameterType.String, value: 'a\nb' }), true)).toBe(
			'a\\nb',
		)
	})

	it('gives an octet string as its bytes, a boolean as it is, and none as null', () => {
		expect(
			parameterVariableValue(parameter({ parameterType: ParameterType.Octets, value: Buffer.from([1, 2]) }), true),
		).toEqual([1, 2])
		expect(parameterVariableValue(parameter({ parameterType: ParameterType.Boolean, value: true }), true)).toBe(true)
		expect(parameterVariableValue(parameter({ value: null }), true)).toBeNull()
		expect(parameterVariableValue(parameter({}), true)).toBeNull()
	})
})
