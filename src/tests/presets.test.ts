import { describe, it, expect } from 'vitest'
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type { JsonValue } from '@companion-module/base'
import { Model as EmberModel, type EmberClient } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { GetActionsList } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { GetFeedbacksList } from '../feedback.js'
import { parameterProperty, ParameterProperty } from '../feedbacks/property.js'
import type EmberPlusInstance from '../index.js'
import { GetPresetsList } from '../presets.js'
import { presetParameters, type Preset } from '../presets/consts.js'
import { presetFieldsChanged } from '../presets/fields.js'
import { turned } from '../presets/rotaries.js'
import { EmberPlusState } from '../state.js'

const { ParameterType, ParameterAccess, NumberedTreeNodeImpl, EmberNodeImpl, ElementType } = EmberModel

type Node = EmberModel.NumberedTreeNode<EmberModel.EmberElement>

/** A node with children, each given it as their parent, as the library's tree has them */
function node(number: number, identifier: string, children: Node[], fields: Partial<EmberModel.EmberNode> = {}): Node {
	const parent = new NumberedTreeNodeImpl(
		number,
		Object.assign(new EmberNodeImpl(identifier), fields),
		EmberModel.childrenOf(children),
	)
	for (const child of children) child.parent = parent
	return parent
}

/** A parameter of the fields given, read-write unless they say otherwise */
function param(number: number, identifier: string, fields: Partial<EmberModel.Parameter>): Node {
	return new NumberedTreeNodeImpl(number, {
		type: ElementType.Parameter,
		identifier,
		access: ParameterAccess.ReadWrite,
		...fields,
	} as EmberModel.Parameter)
}

/** A state holding the parameters at their numbered paths, as the module registers them */
function registered(...entries: Array<[string, Node]>): EmberPlusState {
	const state = new EmberPlusState()
	for (const [path, element] of entries) state.updateParameterMap(path, element)
	return state
}

/** The tree used throughout: Device (1), its Inputs (1.1) and Meters (1.2) */
function device() {
	const mute = param(1, 'Mute', { parameterType: ParameterType.Boolean, value: false })
	const gain = param(2, 'Gain', {
		parameterType: ParameterType.Integer,
		value: -60,
		minimum: -128,
		maximum: 127,
		factor: 10,
	})
	const mode = param(3, 'Mode', {
		parameterType: ParameterType.Enum,
		value: 1,
		enumeration: 'Off\nOn\nAuto',
	})
	const trim = param(4, 'Trim', { parameterType: ParameterType.Real, value: 0.5, minimum: 0, maximum: 1 })
	const level = param(1, 'Level', {
		parameterType: ParameterType.Integer,
		access: ParameterAccess.Read,
		value: -200,
		streamIdentifier: 9,
		minimum: -1000,
		maximum: 0,
		formula: '$ / 10\n$ * 10',
	})
	const inputs = node(1, 'Inputs', [mute, gain, mode, trim])
	const meters = node(2, 'Meters', [level])
	node(1, 'Device', [inputs, meters])
	return { mute, gain, mode, trim, level }
}

function deviceState(): EmberPlusState {
	const { mute, gain, mode, trim, level } = device()
	return registered(['1.1.1', mute], ['1.1.2', gain], ['1.1.3', mode], ['1.1.4', trim], ['1.2.1', level])
}

function presetsOf(state: EmberPlusState) {
	return GetPresetsList(state)
}

function preset(state: EmberPlusState, id: string): Preset {
	const found = presetsOf(state).presets[id]
	if (!found || found.type !== 'layered') throw new Error(`No layered preset ${id}`)
	return found
}

/** A local variable's start value, or the property its feedback reads */
function variable(button: Preset, name: string): Record<string, unknown> | undefined {
	return button.localVariables?.find((v) => v.variableName === name) as Record<string, unknown> | undefined
}

/** An element by id */
function element(button: Preset, id: string): Record<string, any> {
	const found = button.elements.find((e) => e.id === id)
	if (!found) throw new Error(`No element ${id}`)
	return found as Record<string, any>
}

/**
 * An expression as Companion resolves it, with its own engine and the options Companion passes
 * (shared-lib/lib/Expressions.ts): local variables, and $(this:active), from `variables`
 */
function evaluate(text: string, variables: Record<string, JsonValue>): unknown {
	return ResolveExpression(ParseExpression(text), {
		// This version of the engine names a variable `label:name`
		getVariableValue: (id: string) => variables[id],
		unknownVariableValue: '$NA',
		parseVariables: null,
		stringConcatenation: false,
		processTemplateEscapes: false,
	})
}

/** A rotary's local variables as it starts, with the value and held state given */
function rotaryVariables(button: Preset, value: JsonValue, overrides: Record<string, JsonValue> = {}) {
	const variables: Record<string, JsonValue> = { 'local:value': value, 'this:active': false }
	for (const v of button.localVariables ?? []) {
		if (v.variableType === 'simple') variables[`local:${v.variableName}`] = v.startupValue as JsonValue
	}
	for (const [key, entry] of Object.entries(overrides)) variables[key] = entry
	return variables
}

describe('the parameters with presets', () => {
	it("are named by their path's identifiers, grouped by their parent's, sorted", () => {
		expect(presetParameters(deviceState()).map(({ name, group }) => [name, group])).toEqual([
			['Device.Inputs.Gain', 'Device.Inputs'],
			['Device.Inputs.Mode', 'Device.Inputs'],
			['Device.Inputs.Mute', 'Device.Inputs'],
			['Device.Inputs.Trim', 'Device.Inputs'],
			['Device.Meters.Level', 'Device.Meters'],
		])
	})

	it('leave out a parameter offline, or below a node offline', () => {
		const gain = param(2, 'Gain', { parameterType: ParameterType.Integer, minimum: 0, maximum: 1, isOnline: false })
		const mute = param(1, 'Mute', { parameterType: ParameterType.Boolean })
		node(1, 'Device', [node(1, 'Inputs', [mute], { isOnline: false }), node(2, 'Out', [gain])])
		expect(presetParameters(registered(['1.1.1', mute], ['1.2.2', gain]))).toEqual([])
	})

	// A config change clears the element cache, and a stream's unsubscribing trims it, so that the next use registers
	// afresh; the presets mustn't go with them
	it('keep a parameter whose element the cache no longer holds', () => {
		const state = deviceState()
		state.emberElement.delete('1.2.1')
		state.clearCache()
		expect(presetParameters(state).map(({ path }) => path)).toContain('1.2.1')
		expect(presetsOf(state).presets).toHaveProperty('meter_1.2.1')
	})

	it('take a parameter registered by two spellings of its path once', () => {
		const { gain } = device()
		const state = registered(['1.1.2', gain], ['Device.Inputs.Gain', gain])
		expect(presetParameters(state).map(({ path }) => path)).toEqual(['1.1.2'])
	})
})

describe('toggles', () => {
	it('toggle a read-write boolean, ON or OFF, green while on, with its path along the bottom', () => {
		const button = preset(deviceState(), 'toggle_1.1.1')
		expect(button.name).toBe('Device.Inputs.Mute')
		expect(element(button, 'name')).toMatchObject({ text: 'Device.Inputs.Mute', valign: 'bottom' })
		expect(button.steps[0].down).toEqual([
			{ actionId: 'setValueBoolean', options: { path: '1.1.1', toggle: true, value: false } },
		])
		expect(variable(button, 'value')).toMatchObject({
			feedbackId: 'parameter_property',
			options: { path: '1.1.1', property: 'value' },
		})
		const text = element(button, 'value').text.value as string
		expect(evaluate(text, { 'local:value': true })).toBe('ON')
		expect(evaluate(text, { 'local:value': false })).toBe('OFF')
		expect(evaluate(text, { 'local:value': null })).toBe('')
		const on = String((button.feedbacks[0]?.options as { expression?: unknown }).expression)
		expect(evaluate(on, { 'local:value': true })).toBe(true)
		expect(evaluate(on, { 'local:value': false })).toBe(false)
	})

	it('leave out a boolean that can only be read', () => {
		const mute = param(1, 'Mute', { parameterType: ParameterType.Boolean, access: ParameterAccess.Read })
		// Read is the default when a provider leaves access out
		const solo = param(2, 'Solo', { parameterType: ParameterType.Boolean, access: undefined })
		node(1, 'Device', [mute, solo])
		expect(presetsOf(registered(['1.1', mute], ['1.2', solo])).presets).not.toHaveProperty('toggle_1.1')
		expect(presetsOf(registered(['1.1', mute], ['1.2', solo])).presets).not.toHaveProperty('toggle_1.2')
	})
})

describe('rotaries', () => {
	it('step an integer as displayed, by its factor, within its range as displayed', () => {
		const button = preset(deviceState(), 'rotary_1.1.2')
		expect(variable(button, 'value')).toMatchObject({ options: { path: '1.1.2', property: 'displayed' } })
		expect(variable(button, 'text')).toMatchObject({ options: { path: '1.1.2', property: 'units' } })
		expect(variable(button, 'min')).toMatchObject({ startupValue: -12.8 })
		expect(variable(button, 'max')).toMatchObject({ startupValue: 12.7 })
		// A step of 0.1 dB held, five of them a detent: a 50th of the range, in whole steps
		expect(variable(button, 'step_size_fine')).toMatchObject({ startupValue: 0.1 })
		expect(variable(button, 'step_size')).toMatchObject({ startupValue: 0.5 })
		expect(variable(button, 'logarithmic')).toMatchObject({ startupValue: false })
		const [right] = button.steps[0].rotate_right ?? []
		expect(right).toMatchObject({
			actionId: 'setValueInt',
			options: { path: '1.1.2', relative: false, deviceUnits: false },
		})
		const value = (right?.options as Record<string, { value: string }>).value.value
		expect(evaluate(value, rotaryVariables(button, -6))).toBeCloseTo(-5.5, 10)
		expect(evaluate(value, rotaryVariables(button, -6, { 'this:active': true }))).toBeCloseTo(-5.9, 10)
		expect(evaluate(value, rotaryVariables(button, 12.5))).toBe(12.7)
	})

	it('hold a turn down to the minimum, and send nothing before the value is known', () => {
		const button = preset(deviceState(), 'rotary_1.1.2')
		const value = (button.steps[0].rotate_left?.[0]?.options as Record<string, { value: string }>).value.value
		expect(evaluate(value, rotaryVariables(button, -12.6))).toBe(-12.8)
		// A word, which a number field refuses, so Companion skips the action
		expect(evaluate(value, rotaryVariables(button, null))).toBe('unknown')
	})

	// For a frequency, say: a third of a doubling a detent, a 24th held, and the arc on a log scale
	it('multiply by a fraction of a doubling, and draw the arc logarithmically, when logarithmic', () => {
		const button = preset(deviceState(), 'rotary_1.1.4')
		const turn = (direction: 'left' | 'right', value: JsonValue, overrides: Record<string, JsonValue> = {}) =>
			evaluate(
				turned(direction),
				rotaryVariables(button, value, { 'local:logarithmic': true, 'local:min': 0, 'local:max': 1000, ...overrides }),
			)
		expect(turn('right', 100)).toBeCloseTo(100 * 2 ** (1 / 3), 10)
		expect(turn('left', 100)).toBeCloseTo(100 / 2 ** (1 / 3), 10)
		expect(turn('right', 100, { 'this:active': true })).toBeCloseTo(100 * 2 ** (1 / 24), 10)
		// Up from zero, where multiplying would get nowhere
		expect(turn('right', 0)).toBe(0.001)
		// As set on the button, text included
		expect(turn('right', 100, { 'local:logarithmic': 'false' })).toBe(100 + 0.02)
		const level = element(button, 'dial').options.level.value as string
		expect(evaluate(level, rotaryVariables(button, 100, { 'local:logarithmic': true }))).toBeCloseTo(Math.log(100), 10)
		expect(evaluate(level, rotaryVariables(button, 100))).toBe(100)
	})

	it('step a real without a step of its own by a 50th of its range, a 500th held', () => {
		const button = preset(deviceState(), 'rotary_1.1.4')
		expect(variable(button, 'step_size')).toMatchObject({ startupValue: 0.02 })
		expect(variable(button, 'step_size_fine')).toMatchObject({ startupValue: 0.002 })
		expect(button.steps[0].rotate_right?.[0]).toMatchObject({ actionId: 'setValueReal' })
	})

	it("take a real's range by its formula, lower first", () => {
		const level = param(1, 'Level', {
			parameterType: ParameterType.Real,
			minimum: 0,
			maximum: 100,
			formula: '0 - $\n0 - $',
		})
		node(1, 'Device', [level])
		const button = preset(registered(['1.1', level]), 'rotary_1.1')
		expect(variable(button, 'min')).toMatchObject({ startupValue: -100 })
		expect(variable(button, 'max')).toMatchObject({ startupValue: 0 })
	})

	it('step an enumeration one entry a turn, named, its entries its range where it states none', () => {
		const button = preset(deviceState(), 'rotary_1.1.3')
		expect(variable(button, 'text')).toMatchObject({ options: { path: '1.1.3', property: 'enumeration' } })
		expect(variable(button, 'min')).toMatchObject({ startupValue: 0 })
		expect(variable(button, 'max')).toMatchObject({ startupValue: 2 })
		expect(button.steps[0].rotate_right).toEqual([
			{
				actionId: 'setValueEnum',
				options: {
					path: '1.1.3',
					value: 1,
					asEnum: false,
					enumValue: '',
					relative: true,
					min: { isExpression: true, value: '$(local:min)' },
					max: { isExpression: true, value: '$(local:max)' },
				},
			},
		])
		expect(button.steps[0].rotate_left?.[0]?.options).toMatchObject({ value: -1 })
	})

	it.each([
		['an integer without a maximum', { parameterType: ParameterType.Integer, minimum: 0 }],
		['a real without a minimum', { parameterType: ParameterType.Real, maximum: 1 }],
		['an enumeration without a range or entries', { parameterType: ParameterType.Enum }],
		[
			'an integer that can only be read',
			{ parameterType: ParameterType.Integer, minimum: 0, maximum: 9, access: ParameterAccess.Read },
		],
	])('leave out %s', (_name, fields) => {
		const odd = param(1, 'Odd', fields)
		node(1, 'Device', [odd])
		expect(presetsOf(registered(['1.1', odd])).presets).not.toHaveProperty('rotary_1.1')
	})

	it('show the value as text in the middle and the path along the bottom, each its own font size', () => {
		const button = preset(deviceState(), 'rotary_1.1.2')
		expect(element(button, 'value')).toMatchObject({
			valign: 'center',
			fontsize: { value: '$(local:font_size_value)' },
		})
		expect(element(button, 'name')).toMatchObject({ valign: 'bottom', fontsize: { value: '$(local:font_size_name)' } })
		expect(variable(button, 'font_size_value')).toMatchObject({ startupValue: 24 })
		expect(variable(button, 'font_size_name')).toMatchObject({ startupValue: 16 })
	})
})

describe('meters', () => {
	it('meter a stream as displayed, by its formula, its range as displayed in local variables', () => {
		const button = preset(deviceState(), 'meter_1.2.1')
		expect(variable(button, 'value')).toMatchObject({ options: { path: '1.2.1', property: 'displayed' } })
		expect(variable(button, 'meter_min')).toMatchObject({ startupValue: -100 })
		expect(variable(button, 'meter_max')).toMatchObject({ startupValue: 0 })
		expect(element(button, 'meter')).toMatchObject({
			options: {
				level: { value: '$(local:value)' },
				min: { value: '$(local:meter_min)' },
				max: { value: '$(local:meter_max)' },
				position: 'bottom',
			},
		})
		expect(element(button, 'name')).toMatchObject({ text: 'Device.Meters.Level', valign: 'center' })
		expect(element(button, 'value')).toMatchObject({ valign: 'top' })
		expect(button.steps).toEqual([{ down: [], up: [] }])
	})

	it('start a stream without a range at -100 to 0', () => {
		const level = param(1, 'Level', {
			parameterType: ParameterType.Real,
			access: ParameterAccess.Read,
			streamIdentifier: 3,
		})
		node(1, 'Device', [level])
		const button = preset(registered(['1.1', level]), 'meter_1.1')
		expect(variable(button, 'meter_min')).toMatchObject({ startupValue: -100 })
		expect(variable(button, 'meter_max')).toMatchObject({ startupValue: 0 })
	})

	it('meter only streams', () => {
		expect(Object.keys(presetsOf(deviceState()).presets).filter((id) => id.startsWith('meter_'))).toEqual([
			'meter_1.2.1',
		])
	})
})

describe('the preset list', () => {
	it('has a section for each kind with presets, grouped by parent node, then the matrix buttons', () => {
		const { structure } = presetsOf(deviceState())
		expect(structure.map((section) => section.id)).toEqual(['toggles', 'rotaries', 'meters', 'matrix'])
		const rotaries = structure.find((section) => section.id === 'rotaries')
		expect(rotaries?.definitions).toEqual([
			{
				id: 'rotary_Device.Inputs',
				type: 'simple',
				name: 'Device.Inputs',
				presets: ['rotary_1.1.2', 'rotary_1.1.3', 'rotary_1.1.4'],
			},
		])
	})

	it('leaves out a section with nothing in it', () => {
		expect(presetsOf(new EmberPlusState()).structure.map((section) => section.id)).toEqual(['matrix'])
	})
})

describe('presets against the definitions', () => {
	const config: EmberPlusConfig = { host: '10.0.0.1', port: 9000, factor: true, verbose: false, variables: [] }
	const state = deviceState()
	const actions = GetActionsList({} as EmberPlusInstance, {} as EmberClient, config, state, {} as PQueue) as Record<
		string,
		{ options: Array<{ id: string }> }
	>
	const feedbacks = GetFeedbacksList({} as EmberPlusInstance, {} as EmberClient, config, state) as Record<
		string,
		{ options: Array<{ id: string }> }
	>
	const buttons = Object.entries(presetsOf(state).presets).filter(([, p]) => p?.type === 'layered') as Array<
		[string, Preset]
	>

	it.each(buttons)('%s uses only options its actions have', (_id, button) => {
		for (const step of button.steps) {
			for (const entry of [...step.down, ...step.up, ...(step.rotate_left ?? []), ...(step.rotate_right ?? [])]) {
				const definition = actions[entry.actionId]
				expect(definition, entry.actionId).toBeDefined()
				for (const key of Object.keys(entry.options)) {
					expect(
						definition?.options.map((o) => o.id),
						key,
					).toContain(key)
				}
			}
		}
	})

	it.each(buttons)('%s reads properties Parameter Property has', (_id, button) => {
		for (const v of button.localVariables ?? []) {
			if (v.variableType !== 'feedback') continue
			const definition = feedbacks[v.feedbackId]
			expect(definition, v.feedbackId).toBeDefined()
			for (const key of Object.keys(v.options))
				expect(
					definition?.options.map((o) => o.id),
					key,
				).toContain(key)
			expect(ParameterProperty).toContain((v.options as { property: string }).property)
		}
	})

	// The rotary steps from Value as Displayed, and the Set Value actions convert it back by the same formula or factor
	it('gives a rotary the value as the Set Value actions take it', () => {
		const gain = state.parameters.get('1.1.2')!
		expect(parameterProperty(gain, 'displayed')).toBe(-6)
	})
})

describe('presetFieldsChanged', () => {
	const gain = {
		type: ElementType.Parameter,
		parameterType: ParameterType.Integer,
		value: 1,
		minimum: 0,
	} as EmberModel.Parameter
	const changed = (fields: Record<string, unknown>) => ({ ...gain, ...fields }) as EmberModel.Parameter

	it('tells a change to what the presets are built from', () => {
		expect(presetFieldsChanged(gain, changed({ access: ParameterAccess.Read }))).toBe(true)
		expect(presetFieldsChanged(gain, changed({ isOnline: false }))).toBe(true)
		expect(presetFieldsChanged(gain, changed({ maximum: 9 }))).toBe(true)
	})

	// An enumMap is a Map, which serialises to {} whatever it holds
	it('tells a change to an enumMap', () => {
		const mode = changed({ parameterType: ParameterType.Enum, enumMap: new Map([['Off', 0]]) })
		const more = {
			...mode,
			enumMap: new Map([
				['Off', 0],
				['On', 1],
			]),
		} as EmberModel.Parameter
		const renumbered = { ...mode, enumMap: new Map([['Off', 2]]) } as EmberModel.Parameter
		expect(presetFieldsChanged(mode, more)).toBe(true)
		expect(presetFieldsChanged(mode, renumbered)).toBe(true)
		expect(presetFieldsChanged(mode, { ...mode, enumMap: new Map([['Off', 0]]) })).toBe(false)
	})

	it('ignores a change of value, and an enumMap reported again alike', () => {
		expect(presetFieldsChanged(gain, changed({ value: 2 }))).toBe(false)
		const mode = changed({ parameterType: ParameterType.Enum, enumMap: new Map([['Off', 0]]) })
		expect(presetFieldsChanged(mode, { ...mode, enumMap: new Map([['Off', 0]]) })).toBe(false)
	})
})
