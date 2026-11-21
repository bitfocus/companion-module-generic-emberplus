import { describe, it, expect } from 'vitest'
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionMigrationOptionValues,
	JsonValue,
} from '@companion-module/base'
import { UpgradeScripts } from '../upgrades.js'
import type { EmberPlusConfig } from '../config.js'

/** Options as Companion hands them to upgrade scripts: each wrapped, none an expression before API 2 */
function wrap(options: Record<string, JsonValue | undefined>): CompanionMigrationOptionValues {
	return Object.fromEntries(Object.entries(options).map(([key, value]) => [key, { isExpression: false, value }]))
}

function action(actionId: string, options: Record<string, JsonValue | undefined>): CompanionMigrationAction {
	return { id: `a-${actionId}`, controlId: 'bank:1', actionId, options: wrap(options) }
}

function feedback(feedbackId: string, options: Record<string, JsonValue | undefined>): CompanionMigrationFeedback {
	return { id: `f-${feedbackId}`, controlId: 'bank:1', feedbackId, options: wrap(options) }
}

/** Run the scripts from `from` on, as Companion does for a connection last upgraded before script `from` */
function upgrade(
	{
		actions = [],
		feedbacks = [],
		config = null,
	}: {
		actions?: CompanionMigrationAction[]
		feedbacks?: CompanionMigrationFeedback[]
		config?: EmberPlusConfig | null
	},
	from = 0,
) {
	let currentConfig = config
	const updated = { actions: new Set<string>(), feedbacks: new Set<string>() }
	for (const script of UpgradeScripts.slice(from)) {
		const result = script(
			{ currentConfig: currentConfig ?? ({} as EmberPlusConfig) },
			{ config: currentConfig, secrets: null, actions, feedbacks },
		)
		currentConfig = result.updatedConfig ?? currentConfig
		for (const a of result.updatedActions) updated.actions.add(a.id)
		for (const f of result.updatedFeedbacks) updated.feedbacks.add(f.id)
	}
	return { actions, feedbacks, config: currentConfig, updated }
}

/** The index of the API 2 script, so a test can start from a connection last upgraded by 2.9 */
const API2 = UpgradeScripts.length - 1

/**
 * Evaluate an expression with Companion's own engine, with the options Companion's ResolveExpression passes
 * (shared-lib/lib/Expressions.ts), and parseVariables replacing $(label:name) from `variables`
 */
function evaluate(expression: string, variables: Record<string, string>): unknown {
	const parseVariables = (text: string): string =>
		text.replaceAll(/\$\(([^:)]+:[^)]+)\)/g, (_match, id: string) => variables[id] ?? '$NA')
	return ResolveExpression(ParseExpression(expression), {
		getVariableValue: (idOrLabel, name) => variables[name === undefined ? idOrLabel : `${idOrLabel}:${name}`],
		unknownVariableValue: '$NA',
		parseVariables,
		stringConcatenation: false,
		processTemplateEscapes: false,
	})
}

describe('API 2 upgrade, from a 2.9 connection', () => {
	it('folds a path from text into the path option', () => {
		const { actions } = upgrade(
			{ actions: [action('setValueInt', { path: '9.9', pathVar: '1/2/3', usePathVar: true, value: 1 })] },
			API2,
		)
		expect(actions[0].options.path).toEqual({ isExpression: false, value: '1/2/3' })
		expect(actions[0].options).not.toHaveProperty('pathVar')
		expect(actions[0].options).not.toHaveProperty('usePathVar')
	})

	it('keeps the selected path when the text path was not in use', () => {
		const { actions } = upgrade(
			{ actions: [action('setValueReal', { path: '1.2', pathVar: '3.4', usePathVar: false })] },
			API2,
		)
		expect(actions[0].options.path).toEqual({ isExpression: false, value: '1.2' })
	})

	it('turns a text path holding variables into an expression giving the same path', () => {
		const pathVar = 'Gain "main" \\ [1.2.$(internal:custom_ch)]'
		const { feedbacks } = upgrade({ feedbacks: [feedback('boolean', { path: '', pathVar, usePathVar: true })] }, API2)
		const path = feedbacks[0].options.path
		expect(path?.isExpression).toBe(true)
		expect(evaluate(path?.value as string, { 'internal:custom_ch': '7' })).toBe('Gain "main" \\ [1.2.7]')
	})

	it('folds a number held as text into the number option', () => {
		const { actions } = upgrade(
			{ actions: [action('setValueInt', { path: '1', value: 0, valueVar: '42', useVar: true, factor: '10' })] },
			API2,
		)
		expect(actions[0].options.value).toEqual({ isExpression: false, value: 42 })
		expect(actions[0].options).not.toHaveProperty('valueVar')
		expect(actions[0].options).not.toHaveProperty('useVar')
	})

	it('turns a number held in a variable into an expression', () => {
		const { actions } = upgrade(
			{ actions: [action('matrixConnect', { path: '1', target: 0, targetVar: '$(internal:custom_t)', useVar: true })] },
			API2,
		)
		expect(actions[0].options.target).toEqual({ isExpression: true, value: '$(internal:custom_t)' })
		expect(actions[0].options).not.toHaveProperty('targetVar')
	})

	it('keeps the number option when the text was not in use', () => {
		const { actions } = upgrade(
			{ actions: [action('matrixDisconnect', { path: '1', target: 5, targetVar: '7', useVar: false })] },
			API2,
		)
		expect(actions[0].options.target).toEqual({ isExpression: false, value: 5 })
		expect(actions[0].options).not.toHaveProperty('useVar')
	})

	it('folds both numbers of a selection on the one checkbox', () => {
		const { actions, feedbacks } = upgrade(
			{
				actions: [action('setSelectedSource', { matrix: 0, matrixVar: '2', source: 0, sourceVar: '9', useVar: true })],
				feedbacks: [feedback('targetBackgroundSelected', { matrix: 1, matrixVar: '2', target: 3, targetVar: '4' })],
			},
			API2,
		)
		expect(actions[0].options.matrix?.value).toBe(2)
		expect(actions[0].options.source?.value).toBe(9)
		expect(feedbacks[0].options.matrix?.value).toBe(1)
		expect(feedbacks[0].options.target?.value).toBe(3)
		expect(Object.keys(actions[0].options).sort()).toEqual(['matrix', 'source'])
		expect(Object.keys(feedbacks[0].options).sort()).toEqual(['matrix', 'target'])
	})

	it('reads empty text as 0 where the module did', () => {
		const { actions, feedbacks } = upgrade(
			{
				actions: [action('setValueReal', { path: '1', value: 3, valueVar: '', useVar: true })],
				feedbacks: [feedback('parameter', { path: '1', value: 3, valueVar: ' ', useVar: true, factor: '1' })],
			},
			API2,
		)
		expect(actions[0].options.value).toEqual({ isExpression: false, value: 0 })
		expect(feedbacks[0].options.value).toEqual({ isExpression: false, value: 0 })
	})

	it.each([
		['', 1],
		['abc', 1],
		['10abc', 10],
		['2.7', 2],
		['0', 0],
	])('reads the text factor %j as parseInt did, giving %j', (factor, expected) => {
		const { feedbacks } = upgrade({ feedbacks: [feedback('parameter', { path: '1', value: 1, factor })] }, API2)
		expect(feedbacks[0].options.factor).toEqual({ isExpression: false, value: expected })
	})

	// A Factor of 1 multiplied by nothing: such an action takes the displayed value from now on (a release note warns)
	it.each(['1', '', 'abc'])('drops a Set Value Integer Factor read as 1 (%j), without Device Units', (factor) => {
		const { actions } = upgrade({ actions: [action('setValueInt', { path: '1', value: 5, factor })] }, API2)
		expect(actions[0].options).not.toHaveProperty('factor')
		expect(actions[0].options.deviceUnits).toEqual({ isExpression: false, value: false })
	})

	// Any other Factor is kept, with Device Units, so the action goes on sending value x Factor as it did
	it.each([
		['10', { isExpression: false, value: 10 }],
		['$(internal:custom_f)', { isExpression: true, value: '$(internal:custom_f)' }],
	])('keeps a Set Value Integer Factor of %j, with Device Units', (factor, kept) => {
		const { actions } = upgrade({ actions: [action('setValueInt', { path: '1', value: 5, factor })] }, API2)
		expect(actions[0].options.factor).toEqual(kept)
		expect(actions[0].options.deviceUnits).toEqual({ isExpression: false, value: true })
	})

	// Set Host's port became a number field; empty text kept the current port
	it.each([
		['9001', { isExpression: false, value: 9001 }],
		['', { isExpression: false, value: 9100 }],
		['nine', { isExpression: false, value: 9100 }],
		['$(internal:custom_port)', { isExpression: true, value: '$(internal:custom_port)' }],
	])('turns the Set Host port %j into %j', (port, expected) => {
		const config = { host: '10.0.0.1', port: 9100, factor: true, verbose: false, variables: [] } as EmberPlusConfig
		const { actions } = upgrade({ actions: [action('setHost', { host: '', port })], config }, API2)
		expect(actions[0].options.port).toEqual(expected)
	})

	// The relative limits were text, empty or unreadable meaning no limit. As numbers, no limit is the end of the range
	// Ember+ allows the type
	it.each([
		['setValueInt', '', '', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
		['setValueReal', '', 'abc', -Number.MAX_VALUE, Number.MAX_VALUE],
		['setValueEnum', '', '', 0, Number.MAX_SAFE_INTEGER],
		['setValueInt', '-10', ' 20 ', -10, 20],
		['setValueEnum', '-3', '1e400', 0, Number.MAX_SAFE_INTEGER],
		['setValueInt', '-4294967295', '4294967295', -4294967295, 4294967295],
	])('%s: reads the text limits %j and %j as %j and %j', (actionId, min, max, minValue, maxValue) => {
		const { actions } = upgrade(
			{ actions: [action(actionId, { path: '1', value: 1, relative: true, min, max })] },
			API2,
		)
		expect(actions[0].options.min).toEqual({ isExpression: false, value: minValue })
		expect(actions[0].options.max).toEqual({ isExpression: false, value: maxValue })
	})

	it('turns a limit held in a variable into an expression', () => {
		const { actions } = upgrade(
			{ actions: [action('setValueReal', { path: '1', min: '$(internal:custom_lo)', max: 'top $(internal:x)' })] },
			API2,
		)
		expect(actions[0].options.min).toEqual({ isExpression: true, value: '$(internal:custom_lo)' })
		expect(actions[0].options.max).toEqual({ isExpression: true, value: 'parseVariables("top $(internal:x)")' })
	})

	it('turns a factor held in a variable into an expression', () => {
		const { feedbacks } = upgrade(
			{ feedbacks: [feedback('parameter', { path: '1', factor: '$(internal:custom_f)' })] },
			API2,
		)
		expect(feedbacks[0].options.factor).toEqual({ isExpression: true, value: '$(internal:custom_f)' })
	})

	it.each([
		['true', true],
		['On', true],
		['1', true],
		['yes', true],
		['false', false],
		['OFF', false],
		['0', false],
		['', false],
	])('folds the boolean text %j into the checkbox as %j', (valueVar, expected) => {
		const { actions } = upgrade(
			{ actions: [action('setValueBoolean', { path: '1', value: !expected, valueVar, useVar: true })] },
			API2,
		)
		expect(actions[0].options.value).toEqual({ isExpression: false, value: expected })
		expect(actions[0].options).not.toHaveProperty('valueVar')
	})

	// Companion coerces a checkbox's expression result with !!value, so 'off' would read as true. The
	// expression has to give a boolean itself, read as the module read the text
	it.each([
		['on', true],
		['TRUE', true],
		['x', true],
		['off', false],
		['False', false],
		['0', false],
		['', false],
	])('reads a boolean variable holding %j as %j', (variableValue, expected) => {
		const { actions } = upgrade(
			{ actions: [action('setValueBoolean', { path: '1', valueVar: '$(internal:custom_b)', useVar: true })] },
			API2,
		)
		const value = actions[0].options.value
		expect(value?.isExpression).toBe(true)
		expect(evaluate(value?.value as string, { 'internal:custom_b': variableValue })).toBe(expected)
	})

	it('keeps the boolean checkbox when the text was not in use', () => {
		const { actions } = upgrade(
			{ actions: [action('setValueBoolean', { path: '1', value: true, valueVar: 'false', useVar: false })] },
			API2,
		)
		expect(actions[0].options.value).toEqual({ isExpression: false, value: true })
	})

	// The minimum log level: 0 error, 1 warning, 2 information, 3 debug, 4 console
	it.each([
		[0, false],
		[1, false],
		[2, false],
		[3, true],
		[4, true],
		[undefined, false],
	])('turns the log level %j into Verbose Logs %j', (logging, verbose) => {
		const old = { host: '10.0.0.1', port: 9000, factor: true, logging } as unknown as EmberPlusConfig
		const { config } = upgrade({ config: old }, API2)
		expect(config).toEqual({ host: '10.0.0.1', port: 9000, factor: true, verbose, variables: ['parameterValues'] })
	})

	// Parameter values, so the configured paths keep the variables they had
	it('gives an old config the Connection Variables default, parameter values', () => {
		const old = { host: '10.0.0.1', port: 9000, factor: true, verbose: true } as unknown as EmberPlusConfig
		const { config } = upgrade({ config: old }, API2)
		expect(config?.variables).toEqual(['parameterValues'])
	})

	it('leaves a config that already has Verbose Logs and Connection Variables alone', () => {
		const current: EmberPlusConfig = { host: '10.0.0.1', port: 9000, factor: true, verbose: true, variables: [] }
		const result = UpgradeScripts[API2](
			{ currentConfig: current },
			{ config: current, secrets: null, actions: [], feedbacks: [] },
		)
		expect(result.updatedConfig).toBeNull()
	})

	it('reports only what it changed', () => {
		const { updated } = upgrade(
			{
				actions: [action('take', {}), action('setValueString', { path: '1', value: 'x', parseEscapeChars: true })],
				feedbacks: [feedback('clear', {}), feedback('parameter_property', { path: '1', property: 'value' })],
			},
			API2,
		)
		expect(updated.actions.size).toBe(0)
		expect(updated.feedbacks.size).toBe(0)
	})

	// Connection Variables replaced it: with Parameter - Values on, every parameter in use gets variables
	it.each(['setValueInt', 'setValueReal', 'setValueString', 'setValueBoolean', 'setValueEnum'])(
		'removes Auto Create Variable from %s',
		(actionId) => {
			const { actions, updated } = upgrade({ actions: [action(actionId, { path: '1', variable: true })] }, API2)
			expect(actions[0].options).not.toHaveProperty('variable')
			expect(updated.actions.size).toBe(1)
		},
	)

	// Parameter Value became Parameter Property; its Return ENUM checkbox, the Value as Enumeration Entry property
	it.each([
		[true, 'enumeration'],
		[false, 'value'],
		[undefined, 'value'],
	])('turns Parameter Value with Return ENUM %j into Parameter Property returning %j', (asEnum, property) => {
		const { feedbacks, updated } = upgrade(
			{ feedbacks: [feedback('value', { path: '1', pathVar: '$(a:b)', usePathVar: true, asEnum })] },
			API2,
		)
		expect(feedbacks[0].feedbackId).toBe('parameter_property')
		expect(feedbacks[0].options).toEqual({
			path: { isExpression: true, value: 'parseVariables("$(a:b)")' },
			property: { isExpression: false, value: property },
		})
		expect(updated.feedbacks.size).toBe(1)
	})

	it('changes nothing when run on its own output', () => {
		const first = upgrade(
			{
				actions: [action('setValueInt', { path: '', pathVar: '1', usePathVar: true, valueVar: '2', useVar: true })],
				feedbacks: [feedback('parameter', { path: '1', valueVar: '2', useVar: true, factor: '3' })],
			},
			API2,
		)
		const second = upgrade({ actions: first.actions, feedbacks: first.feedbacks }, API2)
		expect(second.updated.actions.size).toBe(0)
		expect(second.updated.feedbacks.size).toBe(0)
	})
})

describe('the upgrade scripts written before API 2, on wrapped options', () => {
	it('brings a 2.4 variable action through to the API 2 shape', () => {
		const { actions } = upgrade({ actions: [action('setValueIntVariable', { path: '1.2', value: '$(a:b)' })] })
		expect(actions[0].actionId).toBe('setValueInt')
		expect(actions[0].options).toEqual({
			path: { isExpression: false, value: '1.2' },
			value: { isExpression: true, value: '$(a:b)' },
			relative: { isExpression: false, value: false },
			min: { isExpression: false, value: Number.MIN_SAFE_INTEGER },
			max: { isExpression: false, value: Number.MAX_SAFE_INTEGER },
			deviceUnits: { isExpression: false, value: false },
		})
	})

	it('brings a boolean variable action through, reading its text', () => {
		const { actions } = upgrade({ actions: [action('setValueBooleanVariable', { path: '1', value: 'on' })] })
		expect(actions[0].actionId).toBe('setValueBoolean')
		expect(actions[0].options.value).toEqual({ isExpression: false, value: true })
		expect(actions[0].options.toggle).toEqual({ isExpression: false, value: false })
	})

	it('merges an enum lookup action into Set Value ENUM', () => {
		const { actions } = upgrade({ actions: [action('setValueEnumLookup', { path: '1', value: 'Mute' })] })
		expect(actions[0].actionId).toBe('setValueEnum')
		expect(actions[0].options.asEnum).toEqual({ isExpression: false, value: true })
		expect(actions[0].options.enumValue).toEqual({ isExpression: false, value: 'Mute' })
		expect(actions[0].options.value).toEqual({ isExpression: false, value: 0 })
		expect(actions[0].options).not.toHaveProperty('valueVar')
	})

	it('keeps the target of a matrix action from before 2.8', () => {
		const { actions } = upgrade({ actions: [action('matrixConnect', { path: '1', target: 5, sources: '1,2' })] })
		expect(actions[0].options).toEqual({
			path: { isExpression: false, value: '1' },
			target: { isExpression: false, value: 5 },
			sources: { isExpression: false, value: '1,2' },
		})
	})

	it('fills a parameter feedback from before 2.5', () => {
		const { feedbacks } = upgrade({ feedbacks: [feedback('parameter', { path: '1', value: 4 })] })
		expect(feedbacks[0].options).toEqual({
			path: { isExpression: false, value: '1' },
			value: { isExpression: false, value: 4 },
			comparitor: { isExpression: false, value: 'eq' },
			asInt: { isExpression: false, value: false },
			factor: { isExpression: false, value: 1 },
		})
	})

	// 2.7 added the log level at information, which 3.0 turns into Verbose Logs off
	it('brings a config from before 2.7 through to the API 2 shape', () => {
		const { config } = upgrade({ config: { host: '10.0.0.1', port: 9000 } as EmberPlusConfig })
		expect(config).toEqual({
			host: '10.0.0.1',
			port: 9000,
			factor: false,
			verbose: false,
			variables: ['parameterValues'],
		})
	})
})
