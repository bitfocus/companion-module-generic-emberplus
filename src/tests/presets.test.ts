import { describe, it, expect } from 'vitest'
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type { CompanionPresetGroupTemplate, JsonValue } from '@companion-module/base'
import { Model as EmberModel, type EmberClient } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { GetActionsList } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { GetFeedbacksList } from '../feedback.js'
import { parameterProperty, ParameterProperty } from '../feedbacks/property.js'
import type EmberPlusInstance from '../index.js'
import type { ModuleTypes } from '../index.js'
import { GetPresetsList } from '../presets.js'
import { presetParameters, type Preset } from '../presets/consts.js'
import { onlyValueChanged, presetFieldsChanged } from '../presets/fields.js'
import { captureLogs } from './logs.js'
import { EmberPlusState } from '../state.js'

const { ParameterType, ParameterAccess, NumberedTreeNodeImpl, EmberNodeImpl, ElementType } = EmberModel

const logs = captureLogs()

type Node = EmberModel.NumberedTreeNode<EmberModel.EmberElement>
type TemplateGroup = CompanionPresetGroupTemplate<ModuleTypes>

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

/** The template groups of every section */
function groupsOf(state: EmberPlusState): TemplateGroup[] {
	return presetsOf(state).structure.flatMap((section) => section.definitions as TemplateGroup[])
}

/** A template preset */
function template(state: EmberPlusState, id: string): Preset {
	const found = presetsOf(state).presets[id]
	if (!found || found.type !== 'layered') throw new Error(`No layered preset ${id}`)
	return found
}

/** The buttons the template groups of a template make: each parameter's name and path */
function templateValues(state: EmberPlusState, presetId: string) {
	return groupsOf(state)
		.filter((group) => group.presetId === presetId)
		.flatMap((group) => group.templateValues)
}

/** A local variable on a template */
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

/**
 * A button placed from a template group for the parameter at `path`, as Companion makes it: the template's simple
 * variables, the group's common values over them and the path; and each Parameter Property variable as the module's
 * feedback gives it for the parameter. `overrides` stand for values changed on the button.
 */
function placed(state: EmberPlusState, presetId: string, path: string, overrides: Record<string, JsonValue> = {}) {
	const button = template(state, presetId)
	const group = groupsOf(state).find(
		(candidate) => candidate.presetId === presetId && candidate.templateValues.some((value) => value.value === path),
	)
	if (!group) throw new Error(`No group of ${presetId} for ${path}`)
	const variables: Record<string, JsonValue> = { 'this:active': false }
	for (const v of button.localVariables ?? []) {
		if (v.variableType === 'simple') variables[`local:${v.variableName}`] = v.startupValue as JsonValue
	}
	for (const [name, value] of Object.entries(group.commonVariableValues ?? {}))
		variables[`local:${name}`] = value as JsonValue
	variables[`local:${group.templateVariableName}`] = path
	for (const v of button.localVariables ?? []) {
		if (v.variableType !== 'feedback') continue
		const property = (v.options as { property: ParameterProperty }).property
		const parameter = state.parameters.get(path)
		variables[`local:${v.variableName}`] = parameter
			? parameterProperty(parameter, property, state.parameterElements.get(path))
			: null
	}
	for (const [key, value] of Object.entries(overrides)) variables[key] = value
	return { button, group, variables }
}

/** The expression a turn of a rotary sets */
function turnOf(button: Preset, direction: 'left' | 'right'): string {
	const entry = direction === 'left' ? button.steps[0].rotate_left?.[0] : button.steps[0].rotate_right?.[0]
	return (entry?.options as Record<string, { value: string }>).value.value
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
		expect(templateValues(state, 'meter').map(({ value }) => value)).toEqual(['1.2.1'])
	})

	it('take a parameter registered by two spellings of its path once', () => {
		const { gain } = device()
		const state = registered(['1.1.2', gain], ['Device.Inputs.Gain', gain])
		expect(presetParameters(state).map(({ path }) => path)).toEqual(['1.1.2'])
	})
})

describe('the template groups', () => {
	// A button linked to its preset may still change its template variables: its path, and the group's common values
	it('make a button of each parameter from its template, its path the template variable', () => {
		const groups = groupsOf(deviceState())
		expect(groups.map((group) => [group.id, group.name, group.presetId])).toEqual([
			['toggle_Device.Inputs', 'Device.Inputs', 'toggle'],
			['rotary_integer_Device.Inputs', 'Device.Inputs', 'rotary_integer'],
			['rotary_real_Device.Inputs', '', 'rotary_real'],
			['rotary_enumeration_Device.Inputs', '', 'rotary_enumeration'],
			['meter_Device.Meters', 'Device.Meters', 'meter'],
		])
		for (const group of groups) expect(group).toMatchObject({ type: 'template', templateVariableName: 'path' })
		expect(groups[1]?.templateValues).toEqual([{ name: 'Device.Inputs.Gain', value: '1.1.2' }])
	})

	it('expose the font sizes, and on a rotary its range (a number rotary its steps too), on a meter its range', () => {
		const common = (presetId: string) =>
			groupsOf(deviceState()).find((g) => g.presetId === presetId)?.commonVariableValues
		const fontSizes = { font_size_value: 24, font_size_name: 16 }
		expect(common('toggle')).toEqual(fontSizes)
		expect(common('rotary_integer')).toEqual({
			min: 'auto',
			max: 'auto',
			logarithmic: false,
			step_size: 'auto',
			step_size_fine: 'auto',
			step_divisions: 3,
			step_divisions_fine: 24,
			...fontSizes,
		})
		expect(common('rotary_enumeration')).toEqual({ min: 'auto', max: 'auto', ...fontSizes })
		expect(common('meter')).toEqual({ meter_min: 'auto', meter_max: 'auto', ...fontSizes })
	})

	// Two buttons from the one template
	it('log how many buttons they make', () => {
		const [mute, solo] = [
			param(1, 'Mute', { parameterType: ParameterType.Boolean }),
			param(2, 'Solo', { parameterType: ParameterType.Boolean }),
		]
		node(1, 'Device', [mute, solo])
		presetsOf(registered(['1.1', mute], ['1.2', solo]))
		expect(logs).toHaveBeenCalledWith('Presets', 'debug', '2 parameter presets, from 2 parameters')
	})

	it('define each template used, and no other', () => {
		expect(Object.keys(presetsOf(deviceState()).presets).sort()).toEqual([
			'meter',
			'rotary_enumeration',
			'rotary_integer',
			'rotary_real',
			'toggle',
		])
		const { mute } = device()
		expect(Object.keys(presetsOf(registered(['1.1.1', mute])).presets)).toEqual(['toggle'])
	})

	it('have a section for each kind with presets, then the matrix buttons with a matrix', () => {
		expect(presetsOf(deviceState()).structure.map((section) => section.id)).toEqual(['toggles', 'rotaries', 'meters'])
		const withMatrix = deviceState()
		withMatrix.setMatrixPaths(['2.1'])
		expect(presetsOf(withMatrix).structure.map((section) => section.id)).toEqual([
			'toggles',
			'rotaries',
			'meters',
			'matrix',
		])
	})

	// Without a matrix, the XY buttons' actions and feedbacks aren't offered, so neither are they
	it('leave out a section with nothing in it, and the XY buttons without a matrix', () => {
		const { structure, presets } = presetsOf(new EmberPlusState())
		expect(structure).toEqual([])
		expect(presets).toEqual({})
	})

	// An id keeps only letters, digits, _, . and -: parents differing in the rest, and the top level beside a node named
	// top, would share one
	it('give each group an id of its own', () => {
		const mute = () => param(1, 'Mute', { parameterType: ParameterType.Boolean })
		const [top, inTop, inSpaced, inUnderscored] = [mute(), mute(), mute(), mute()]
		node(2, 'top', [inTop])
		node(3, 'In 1', [inSpaced])
		node(4, 'In_1', [inUnderscored])
		const state = registered(['Mute', top], ['top.Mute', inTop], ['In 1.Mute', inSpaced], ['In_1.Mute', inUnderscored])
		const ids = groupsOf(state).map((group) => group.id)
		expect(ids).toHaveLength(4)
		expect(new Set(ids).size).toBe(4)
		expect(ids).toContain('toggle')
		expect(templateValues(state, 'toggle')).toHaveLength(4)
	})
})

describe('toggles', () => {
	it('toggle a read-write boolean, ON or OFF, green while on, its path by identifiers along the bottom', () => {
		const { button, variables } = placed(deviceState(), 'toggle', '1.1.1')
		expect(button.steps[0].down).toEqual([
			{
				actionId: 'setValueBoolean',
				options: { path: { isExpression: true, value: '$(local:path)' }, toggle: true, value: false },
			},
		])
		expect(variable(button, 'value')).toMatchObject({
			feedbackId: 'parameter_property',
			options: { path: { isExpression: true, value: '$(local:path)' }, property: 'value' },
		})
		expect(evaluate(element(button, 'name').text.value, variables)).toBe('Device.Inputs.Mute')
		const text = element(button, 'value').text.value as string
		expect(evaluate(text, { 'local:value': true })).toBe('ON')
		expect(evaluate(text, variables)).toBe('OFF')
		expect(evaluate(text, { 'local:value': null })).toBe('')
		const on = String((button.feedbacks[0]?.options as { expression?: unknown }).expression)
		expect(evaluate(on, { 'local:value': true })).toBe(true)
		expect(evaluate(on, variables)).toBe(false)
	})

	it('leave out a boolean that can only be read', () => {
		const mute = param(1, 'Mute', { parameterType: ParameterType.Boolean, access: ParameterAccess.Read })
		// Read is the default when a provider leaves access out
		const solo = param(2, 'Solo', { parameterType: ParameterType.Boolean, access: undefined })
		node(1, 'Device', [mute, solo])
		expect(templateValues(registered(['1.1', mute], ['1.2', solo]), 'toggle')).toEqual([])
	})
})

describe('rotaries', () => {
	it('step an integer as displayed, its range and step by its factor, read from the parameter', () => {
		const state = deviceState()
		const { button, variables } = placed(state, 'rotary_integer', '1.1.2')
		expect(variables).toMatchObject({
			'local:value': -6,
			'local:range_min': -12.8,
			'local:range_max': 12.7,
			'local:unit': 0.1,
			'local:text': '-6.0',
		})
		expect(button.steps[0].rotate_right?.[0]).toMatchObject({
			actionId: 'setValueInt',
			options: { path: { value: '$(local:path)' }, relative: false, deviceUnits: false },
		})
		// auto: a 50th of the range, in whole steps of 0.1 dB, so 0.5 dB; held, its own step
		expect(evaluate(turnOf(button, 'right'), variables)).toBeCloseTo(-5.5, 10)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'this:active': true })).toBeCloseTo(-5.9, 10)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:value': 12.5 })).toBe(12.7)
		expect(evaluate(turnOf(button, 'left'), { ...variables, 'local:value': -12.6 })).toBe(-12.8)
	})

	it('take a step set on the button, and work one out for anything else', () => {
		const { button, variables } = placed(deviceState(), 'rotary_integer', '1.1.2')
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:step_size': 1 })).toBeCloseTo(-5, 10)
		// As typed on the button
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:step_size': '2' })).toBeCloseTo(-4, 10)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:step_size': 0 })).toBeCloseTo(-5.5, 10)
		expect(
			evaluate(turnOf(button, 'right'), { ...variables, 'local:step_size_fine': 0.2, 'this:active': true }),
		).toBeCloseTo(-5.8, 10)
	})

	it('send nothing until the value and the range are known', () => {
		const { button, variables } = placed(deviceState(), 'rotary_integer', '1.1.2')
		// A word, which a number field refuses, so Companion skips the action
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:value': null })).toBe('unknown')
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:range_max': null })).toBe('unknown')
		expect(evaluate(turnOf(button, 'left'), { ...variables, 'local:range_min': null })).toBe('unknown')
	})

	// Set on the button, linked or not, to limit what a turn sets
	it("hold a turn to a range set on the button, the parameter's own for an end left auto", () => {
		const { button, variables } = placed(deviceState(), 'rotary_integer', '1.1.2', { 'local:max': 6 })
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'local:value': 5.8 })).toBe(6)
		expect(evaluate(turnOf(button, 'left'), { ...variables, 'local:value': -12.6 })).toBe(-12.8)
		const dial = element(button, 'dial').options
		expect(evaluate(dial.max.value, variables)).toBe(6)
		expect(evaluate(dial.min.value, variables)).toBe(-12.8)
	})

	// Its own step as large as its range would take every detent from one end to the other
	it('step a real by its range where its own step is no smaller than it', () => {
		const coarse = param(1, 'Coarse', {
			parameterType: ParameterType.Real,
			value: 0.5,
			minimum: 0,
			maximum: 1,
			step: 1,
		})
		node(1, 'Device', [coarse])
		const { button, variables } = placed(registered(['1.1', coarse]), 'rotary_real', '1.1')
		expect(variables['local:unit']).toBe(1)
		expect(evaluate(turnOf(button, 'right'), variables)).toBeCloseTo(0.52, 10)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'this:active': true })).toBeCloseTo(0.502, 10)
	})

	// An integer's own step can't be split: a smaller one would be rounded away
	it('step an integer by its own step where that is its whole range', () => {
		const toggle = param(1, 'Mode', { parameterType: ParameterType.Integer, value: 0, minimum: 0, maximum: 1 })
		node(1, 'Device', [toggle])
		const { button, variables } = placed(registered(['1.1', toggle]), 'rotary_integer', '1.1')
		expect(evaluate(turnOf(button, 'right'), variables)).toBe(1)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'this:active': true })).toBe(1)
	})

	it('step a real without a step of its own by a 50th of its range, a 500th held', () => {
		const { button, variables } = placed(deviceState(), 'rotary_real', '1.1.4')
		expect(variables['local:unit']).toBeNull()
		expect(button.steps[0].rotate_right?.[0]).toMatchObject({ actionId: 'setValueReal' })
		expect(evaluate(turnOf(button, 'right'), variables)).toBeCloseTo(0.52, 10)
		expect(evaluate(turnOf(button, 'right'), { ...variables, 'this:active': true })).toBeCloseTo(0.502, 10)
	})

	// For a frequency, say: a third of a doubling a detent, a 24th held, and the arc on a log scale
	it('multiply by a fraction of a doubling, and draw the arc logarithmically, when logarithmic', () => {
		const { button, variables } = placed(deviceState(), 'rotary_real', '1.1.4', {
			'local:logarithmic': true,
			'local:max': 1000,
		})
		const turn = (direction: 'left' | 'right', value: JsonValue, overrides: Record<string, JsonValue> = {}) =>
			evaluate(turnOf(button, direction), { ...variables, 'local:value': value, ...overrides })
		expect(turn('right', 100)).toBeCloseTo(100 * 2 ** (1 / 3), 10)
		expect(turn('left', 100)).toBeCloseTo(100 / 2 ** (1 / 3), 10)
		expect(turn('right', 100, { 'this:active': true })).toBeCloseTo(100 * 2 ** (1 / 24), 10)
		// Up from zero, where multiplying would get nowhere
		expect(turn('right', 0)).toBe(0.001)
		// As set on the button, text included
		expect(turn('right', 100, { 'local:logarithmic': 'false', 'local:step_size': 1 })).toBe(101)
		const level = element(button, 'dial').options.level.value as string
		expect(evaluate(level, { ...variables, 'local:value': 100 })).toBeCloseTo(Math.log(100), 10)
		expect(evaluate(level, { ...variables, 'local:value': 100, 'local:logarithmic': false })).toBe(100)
	})

	it("read a real's range by its formula, lower first", () => {
		const level = param(1, 'Level', {
			parameterType: ParameterType.Real,
			minimum: 0,
			maximum: 100,
			formula: '0 - $\n0 - $',
		})
		node(1, 'Device', [level])
		const { variables } = placed(registered(['1.1', level]), 'rotary_real', '1.1')
		expect(variables).toMatchObject({ 'local:range_min': -100, 'local:range_max': 0 })
	})

	it('step an enumeration one entry a turn, named, its entries its range where it states none', () => {
		const { button, variables } = placed(deviceState(), 'rotary_enumeration', '1.1.3')
		expect(variables).toMatchObject({
			'local:value': 1,
			'local:text': 'On',
			'local:range_min': 0,
			'local:range_max': 2,
		})
		const [right] = button.steps[0].rotate_right ?? []
		expect(right).toMatchObject({
			actionId: 'setValueEnum',
			options: { path: { isExpression: true, value: '$(local:path)' }, value: 1, asEnum: false, relative: true },
		})
		const limits = right?.options as Record<string, { value: string }>
		expect(evaluate(limits.min.value, variables)).toBe(0)
		expect(evaluate(limits.max.value, variables)).toBe(2)
		expect(evaluate(limits.max.value, { ...variables, 'local:max': 1 })).toBe(1)
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
		const state = registered(['1.1', odd])
		for (const id of ['rotary_integer', 'rotary_real', 'rotary_enumeration'])
			expect(templateValues(state, id)).toEqual([])
	})

	it('show the value as text in the middle and the path along the bottom, each its own font size', () => {
		const { button } = placed(deviceState(), 'rotary_integer', '1.1.2')
		expect(element(button, 'value')).toMatchObject({
			valign: 'center',
			fontsize: { value: '$(local:font_size_value)' },
		})
		expect(element(button, 'name')).toMatchObject({ valign: 'bottom', fontsize: { value: '$(local:font_size_name)' } })
	})
})

describe('meters', () => {
	it('meter a stream as displayed, by its formula, on its own range unless the button sets one', () => {
		const { button, variables } = placed(deviceState(), 'meter', '1.2.1')
		expect(variables).toMatchObject({ 'local:value': -20, 'local:range_min': -100, 'local:range_max': 0 })
		const meter = element(button, 'meter').options
		expect(meter).toMatchObject({ level: { value: '$(local:value)' }, position: 'bottom' })
		expect(evaluate(meter.min.value, variables)).toBe(-100)
		expect(evaluate(meter.max.value, variables)).toBe(0)
		expect(evaluate(meter.min.value, { ...variables, 'local:meter_min': -60 })).toBe(-60)
		expect(evaluate(element(button, 'name').text.value, variables)).toBe('Device.Meters.Level')
		expect(element(button, 'name')).toMatchObject({ valign: 'center' })
		expect(element(button, 'value')).toMatchObject({ valign: 'top' })
		expect(button.steps).toEqual([{ down: [], up: [] }])
	})

	it('meter a stream without a range from -100 to 0', () => {
		const level = param(1, 'Level', {
			parameterType: ParameterType.Real,
			access: ParameterAccess.Read,
			streamIdentifier: 3,
		})
		node(1, 'Device', [level])
		const { button, variables } = placed(registered(['1.1', level]), 'meter', '1.1')
		const meter = element(button, 'meter').options
		expect(evaluate(meter.min.value, variables)).toBe(-100)
		expect(evaluate(meter.max.value, variables)).toBe(0)
	})

	it('meter only streams', () => {
		expect(templateValues(deviceState(), 'meter').map(({ value }) => value)).toEqual(['1.2.1'])
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
})

describe('onlyValueChanged', () => {
	const gain = { type: ElementType.Parameter, parameterType: ParameterType.Integer, value: 1, minimum: 0 }
	it('tells a report of only a new value from one changing anything else', () => {
		expect(onlyValueChanged(gain as EmberModel.Parameter, { ...gain, value: 2 } as EmberModel.Parameter)).toBe(true)
		expect(onlyValueChanged(gain as EmberModel.Parameter, { ...gain, minimum: -1 } as EmberModel.Parameter)).toBe(false)
		expect(onlyValueChanged(gain as EmberModel.Parameter, { ...gain, factor: 10 } as EmberModel.Parameter)).toBe(false)
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
