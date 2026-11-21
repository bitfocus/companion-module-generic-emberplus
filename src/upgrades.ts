import {
	FixupNumericOrVariablesValueToExpressions,
	type CompanionMigrationAction,
	type CompanionMigrationFeedback,
	type CompanionMigrationOptionValues,
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionStaticUpgradeScript,
	type CompanionUpgradeContext,
	type ExpressionOrValue,
	type JsonValue,
} from '@companion-module/base'
import { ActionId } from './actions.js'
import type { EmberPlusConfig } from './config.js'
import { FeedbackId } from './feedback.js'
import { comparitorOptions } from './util.js'

// Companion hands every script its options wrapped as { isExpression, value }, the scripts written before API 2
// included. Those still run for a connection upgrading from a version older than they are, so they read and write
// wrapped values too. Before API 2 no option could be an expression.

type Props = CompanionStaticUpgradeProps<EmberPlusConfig, undefined>
type Result = CompanionStaticUpgradeResult<EmberPlusConfig, undefined>
type Context = CompanionUpgradeContext<EmberPlusConfig>
type OptionValue = ExpressionOrValue<JsonValue | undefined>

/**
 * The config as versions before 3.0 saved it: with `logging`, the minimum log level (0 error, 1 warning,
 * 2 information, 3 debug, 4 console), which v300 turns into `verbose`
 */
type LegacyConfig = Omit<EmberPlusConfig, 'verbose' | 'variables'> & {
	logging?: number
	verbose?: boolean
	variables?: EmberPlusConfig['variables']
}
const LegacyLogLevel = { Information: 2, Debug: 3 } as const

function emptyResult(): Result {
	return { updatedActions: [], updatedConfig: null, updatedFeedbacks: [] }
}

function plain(value: JsonValue): OptionValue {
	return { isExpression: false, value }
}

/** An option's value as text, as the module read it before API 2 */
function textOf(option: OptionValue | undefined, fallback: string = ''): string {
	const value = option?.value
	if (value === undefined || value === null) return fallback
	return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** Whether a checkbox is ticked */
function isTicked(option: OptionValue | undefined): boolean {
	return option?.isExpression === false && Boolean(option.value)
}

/** Text for Companion's parseVariables(), as a string literal in an expression */
function parseVariablesOf(text: string): string {
	return `parseVariables("${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

function v250(_context: Context, props: Props): Result {
	const result = emptyResult()

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'setValueBoolean':
			case 'setValueEnum':
			case 'setValueInt':
			case 'setValueReal':
				action.options.useVar ??= plain(false)
				action.options.variable ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setValueBooleanVariable':
				action.actionId = 'setValueBoolean'
				action.options.useVar = plain(true)
				action.options.valueVar = action.options.value
				action.options.value = plain(false)
				action.options.variable ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setValueEnumVariable':
				action.actionId = 'setValueEnum'
				action.options.useVar = plain(true)
				action.options.valueVar = action.options.value
				action.options.value = plain(0)
				action.options.variable ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setValueIntVariable':
				action.actionId = 'setValueInt'
				action.options.useVar = plain(true)
				action.options.valueVar = action.options.value
				action.options.value = plain(0)
				action.options.variable ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setValueRealVariable':
				action.actionId = 'setValueReal'
				action.options.useVar = plain(true)
				action.options.valueVar = action.options.value
				action.options.value = plain(0)
				action.options.variable ??= plain(false)
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'parameter':
				feedback.options.valueVar ??= plain('0')
				feedback.options.comparitor ??= plain(comparitorOptions[0].id)
				feedback.options.useVar ??= plain(false)
				feedback.options.asInt ??= plain(false)
				result.updatedFeedbacks.push(feedback)
		}
	}
	return result
}

function v260(_context: Context, props: Props): Result {
	const result = emptyResult()

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'setValueBoolean':
				action.options.toggle ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setValueEnum':
			case 'setValueInt':
			case 'setValueReal':
				action.options.relative ??= plain(false)
				action.options.min ??= plain('')
				action.options.max ??= plain('')
				result.updatedActions.push(action)
		}
	}
	return result
}

function v270(_context: Context, props: Props): Result {
	const result = emptyResult()

	if (props.config) {
		const config: LegacyConfig = {
			...props.config,
			factor: props.config.factor ?? false,
			logging: (props.config as LegacyConfig).logging ?? LegacyLogLevel.Information,
		}
		result.updatedConfig = config as EmberPlusConfig
	}

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'setValueInt':
				action.options.factor ??= plain('1')
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= plain(true)
				result.updatedActions.push(action)
				break
			case 'setValueString':
				action.options.parseEscapeChars ??= plain(false)
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= plain(true)
				result.updatedActions.push(action)
				break
			case 'setValueReal':
			case 'setValueEnum':
			case 'setValueBoolean':
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= plain(true)
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'parameter':
				feedback.options.factor ??= plain('1')
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= plain(false)
				result.updatedFeedbacks.push(feedback)
				break
			case 'string':
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= plain(false)
				feedback.options.parseEscapeChars ??= plain(false)
				result.updatedFeedbacks.push(feedback)
				break
			case 'boolean':
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= plain(false)
				result.updatedFeedbacks.push(feedback)
				break
		}
	}
	return result
}

function mergeEnumActions(_context: Context, props: Props): Result {
	const result = emptyResult()

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'setValueEnum':
				action.options.asEnum ??= plain(false)
				action.options.enumValue ??= plain('')
				result.updatedActions.push(action)
				break
			case 'setValueEnumLookup':
				action.actionId = 'setValueEnum'
				action.options.enumValue = action.options.value
				action.options.asEnum = plain(true)
				action.options.value = plain(0)
				action.options.valueVar = plain('0')
				action.options.useVar = plain(false)
				action.options.relative = plain(false)
				action.options.min = plain('0')
				action.options.max = plain('')
				result.updatedActions.push(action)
				break
		}
	}
	return result
}

function v280(_context: Context, props: Props): Result {
	const result = emptyResult()

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'matrixConnect':
			case 'matrixDisconnect':
			case 'matrixSetConnection':
				action.options.targetVar ??= plain(textOf(action.options.target, '0'))
				action.options.useVar ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setSelectedSource':
				action.options.matrixVar ??= plain(textOf(action.options.matrix, '0'))
				action.options.sourceVar ??= plain(textOf(action.options.source, '0'))
				action.options.useVar ??= plain(false)
				result.updatedActions.push(action)
				break
			case 'setSelectedTarget':
				action.options.matrixVar ??= plain(textOf(action.options.matrix, '0'))
				action.options.targetVar ??= plain(textOf(action.options.target, '0'))
				action.options.useVar ??= plain(false)
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'sourceBackgroundSelected':
				feedback.options.useVar ??= plain(false)
				feedback.options.sourceVar ??= plain(textOf(feedback.options.source, '0'))
				feedback.options.matrixVar ??= plain(textOf(feedback.options.matrix, '0'))
				result.updatedFeedbacks.push(feedback)
				break
			case 'targetBackgroundSelected':
				feedback.options.useVar ??= plain(false)
				feedback.options.targetVar ??= plain(textOf(feedback.options.target, '0'))
				feedback.options.matrixVar ??= plain(textOf(feedback.options.matrix, '0'))
				result.updatedFeedbacks.push(feedback)
				break
		}
	}
	return result
}

// API 2: each option and the 'Use Variable?' field beside it fold into one option, which the user can switch to an
// expression. The lists below are frozen history for v300: don't edit them to follow later changes, add a script.

/** Pairs of a number option and the text option that held a number or variables in its place */
interface NumericPair {
	value: string
	variable: string
	/** What an empty text option meant: the module read '' as 0 in some places, and as invalid in others */
	empty?: number
}

/** Each item's 'Use Variable?' pairs, keyed by the checkbox that chose between them */
export const numericPairsApi2: {
	actions: Partial<Record<string, { useVar: string; pairs: NumericPair[] }>>
	feedbacks: Partial<Record<string, { useVar: string; pairs: NumericPair[] }>>
} = {
	actions: {
		[ActionId.SetValueInt]: { useVar: 'useVar', pairs: [{ value: 'value', variable: 'valueVar', empty: 0 }] },
		[ActionId.SetValueReal]: { useVar: 'useVar', pairs: [{ value: 'value', variable: 'valueVar', empty: 0 }] },
		[ActionId.SetValueEnum]: { useVar: 'useVar', pairs: [{ value: 'value', variable: 'valueVar' }] },
		[ActionId.MatrixConnect]: { useVar: 'useVar', pairs: [{ value: 'target', variable: 'targetVar' }] },
		[ActionId.MatrixDisconnect]: { useVar: 'useVar', pairs: [{ value: 'target', variable: 'targetVar' }] },
		[ActionId.MatrixSetConnection]: { useVar: 'useVar', pairs: [{ value: 'target', variable: 'targetVar' }] },
		[ActionId.SetSelectedSource]: {
			useVar: 'useVar',
			pairs: [
				{ value: 'matrix', variable: 'matrixVar' },
				{ value: 'source', variable: 'sourceVar' },
			],
		},
		[ActionId.SetSelectedTarget]: {
			useVar: 'useVar',
			pairs: [
				{ value: 'matrix', variable: 'matrixVar' },
				{ value: 'target', variable: 'targetVar' },
			],
		},
	},
	feedbacks: {
		[FeedbackId.Parameter]: { useVar: 'useVar', pairs: [{ value: 'value', variable: 'valueVar', empty: 0 }] },
		[FeedbackId.SourceBackgroundSelected]: {
			useVar: 'useVar',
			pairs: [
				{ value: 'matrix', variable: 'matrixVar' },
				{ value: 'source', variable: 'sourceVar' },
			],
		},
		[FeedbackId.TargetBackgroundSelected]: {
			useVar: 'useVar',
			pairs: [
				{ value: 'matrix', variable: 'matrixVar' },
				{ value: 'target', variable: 'targetVar' },
			],
		},
	},
}

/** Action options 3.0 removed. Auto Create Variable (`variable`): the Connection Variables config replaced it */
export const removedOptionsApi2: Partial<Record<string, string[]>> = {
	[ActionId.SetValueInt]: ['variable'],
	[ActionId.SetValueReal]: ['variable'],
	[ActionId.SetValueString]: ['variable'],
	[ActionId.SetValueBoolean]: ['variable'],
	[ActionId.SetValueEnum]: ['variable'],
}

/** Items whose path dropdown had a text path beside it, chosen by 'Path from String' */
export const pathPairsApi2: { actions: string[]; feedbacks: string[] } = {
	actions: [
		ActionId.SetValueInt,
		ActionId.SetValueReal,
		ActionId.SetValueString,
		ActionId.SetValueBoolean,
		ActionId.SetValueEnum,
		ActionId.InvokeFunction,
	],
	// 'value' is Parameter Property's id before 3.0 (renamedFeedbacksApi2): the paths fold before the rename
	feedbacks: [FeedbackId.Parameter, FeedbackId.String, FeedbackId.Boolean, FeedbackId.ENUM, 'value'],
}

/** Factors that were text holding a whole number, now number options */
export const numericOptionsApi2: {
	actions: Partial<Record<string, string[]>>
	feedbacks: Partial<Record<string, string[]>>
} = {
	actions: { [ActionId.SetValueInt]: ['factor'] },
	feedbacks: { [FeedbackId.Parameter]: ['factor'] },
}

/**
 * A relative action's limits, text before API 2, and the ends of the range a number option for each now holds: the
 * values Ember+ allows the type. Frozen with the rest: written out rather than taken from the definitions.
 */
export const limitOptionsApi2: Partial<Record<string, { min: number; max: number }>> = {
	[ActionId.SetValueInt]: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
	[ActionId.SetValueReal]: { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
	[ActionId.SetValueEnum]: { min: 0, max: Number.MAX_SAFE_INTEGER },
}

/**
 * A limit held as text as a number or an expression. The module read empty or unreadable text as no limit, which is
 * now the range's own end; a number beyond the range is held to it.
 */
function limitOf(option: OptionValue | undefined, range: { min: number; max: number }, end: number): OptionValue {
	if (option?.isExpression) return option
	const text = textOf(option)
	if (text.includes('$(')) return numberOf(option) ?? plain(end)
	const number = text.trim() === '' ? NaN : Number(text)
	if (Number.isNaN(number)) return plain(end)
	return plain(Math.min(Math.max(number, range.min), range.max))
}

function fixupLimits(
	options: CompanionMigrationOptionValues,
	range: { min: number; max: number } | undefined,
): boolean {
	if (!range) return false
	let changed = false
	for (const [key, end] of [
		['min', range.min],
		['max', range.max],
	] as const) {
		const current = options[key]
		const result = limitOf(current, range, end)
		if (result.isExpression !== current?.isExpression || result.value !== current?.value) {
			options[key] = result
			changed = true
		}
	}
	return changed
}

/** A number held as text, or variables, as a number or an expression. Empty text becomes `empty`, if given */
function numberOf(option: OptionValue | undefined, empty?: number): OptionValue | undefined {
	if (empty !== undefined && textOf(option).trim() === '') return plain(empty)
	return FixupNumericOrVariablesValueToExpressions(option)
}

/**
 * The Boolean action's text value, as a checkbox or an expression. The module read the text, variables replaced, as
 * false when it was empty or, in any case, 'false', 'off' or '0'. Companion's bool() only knows 'false' and '0'.
 */
function booleanOf(option: OptionValue | undefined): OptionValue {
	const text = textOf(option)
	if (text.includes('$(')) {
		return {
			isExpression: true,
			value: `!arrayIncludes(['', 'false', 'off', '0'], toLowerCase(${parseVariablesOf(text)}))`,
		}
	}
	return plain(!['', 'false', 'off', '0'].includes(text.toLowerCase()))
}

/** A text path as the dropdown's value, or as an expression where it holds variables */
function pathOf(option: OptionValue | undefined): OptionValue {
	const text = textOf(option)
	return text.includes('$(') ? { isExpression: true, value: parseVariablesOf(text) } : plain(text)
}

/** Remove options, returning whether any were there */
function remove(options: CompanionMigrationOptionValues, ...keys: string[]): boolean {
	let removed = false
	for (const key of keys) {
		if (key in options) {
			delete options[key]
			removed = true
		}
	}
	return removed
}

function foldPath(options: CompanionMigrationOptionValues): boolean {
	if (isTicked(options.usePathVar)) options.path = pathOf(options.pathVar)
	return remove(options, 'pathVar', 'usePathVar')
}

function foldNumericPairs(
	options: CompanionMigrationOptionValues,
	fold: { useVar: string; pairs: NumericPair[] } | undefined,
): boolean {
	if (!fold) return false
	const useVar = isTicked(options[fold.useVar])
	let changed = false
	for (const pair of fold.pairs) {
		if (useVar) options[pair.value] = numberOf(options[pair.variable], pair.empty)
		changed = remove(options, pair.variable) || changed
	}
	return remove(options, fold.useVar) || changed
}

function fixupNumbers(options: CompanionMigrationOptionValues, keys: string[] | undefined): boolean {
	let changed = false
	for (const key of keys ?? []) {
		// An option a script removed, as deviceUnitsOf removes a Factor of 1, isn't made again
		if (!(key in options)) continue
		const current = options[key]
		// The module read the factor with parseInt, and an empty or unreadable one as 1
		const text = textOf(current)
		const parsed = Number.parseInt(text)
		let result: OptionValue | undefined
		if (current?.isExpression) result = current
		else if (text.includes('$(')) result = numberOf(current)
		else result = plain(Number.isNaN(parsed) ? 1 : parsed)
		// The helper hands back a new object either way, so compare what it holds
		if (result?.isExpression !== current?.isExpression || result?.value !== current?.value) {
			options[key] = result
			changed = true
		}
	}
	return changed
}

/**
 * Set Value Integer's value became the displayed value, converted by the parameter's own formula or factor, and its
 * Factor option went. A Factor of 1 multiplied by nothing, so such an action takes displayed values from now on (the
 * release notes warn, for a parameter with a factor or formula). Any other Factor is kept, with Device Units ticked, so
 * the action goes on sending its value multiplied by it. Runs after fixupNumbers has made the Factor a number.
 */
function deviceUnitsOf(action: CompanionMigrationAction): boolean {
	if (action.actionId !== (ActionId.SetValueInt as string) || !('factor' in action.options)) return false
	const { options } = action
	if (options.factor?.isExpression === false && options.factor.value === 1) {
		delete options.factor
		options.deviceUnits = plain(false)
		return true
	}
	if (isTicked(options.deviceUnits)) return false
	options.deviceUnits = plain(true)
	return true
}

/**
 * Set Host's port became a number. Text holding variables becomes an expression. Empty text kept the current port, so
 * it becomes the port the connection had when upgraded, as does text that is no port.
 */
function setHostPortOf(action: CompanionMigrationAction, currentPort: number): boolean {
	const current = action.options.port
	if (action.actionId !== (ActionId.SetHost as string) || !current || current.isExpression) return false
	const text = textOf(current).trim()
	const port = Number(text)
	const result = text.includes('$(')
		? numberOf(current)
		: plain(text !== '' && Number.isInteger(port) ? port : currentPort)
	if (result?.isExpression === current.isExpression && result.value === current.value) return false
	action.options.port = result
	return true
}

function foldAction(action: CompanionMigrationAction, currentPort: number): boolean {
	const options = action.options
	let changed = false
	if (pathPairsApi2.actions.includes(action.actionId)) changed = foldPath(options) || changed
	if (action.actionId === (ActionId.SetValueBoolean as string)) {
		if (isTicked(options.useVar)) options.value = booleanOf(options.valueVar)
		changed = remove(options, 'valueVar', 'useVar') || changed
	}
	changed = foldNumericPairs(options, numericPairsApi2.actions[action.actionId]) || changed
	changed = fixupNumbers(options, numericOptionsApi2.actions[action.actionId]) || changed
	changed = fixupLimits(options, limitOptionsApi2[action.actionId]) || changed
	changed = remove(options, ...(removedOptionsApi2[action.actionId] ?? [])) || changed
	changed = deviceUnitsOf(action) || changed
	changed = setHostPortOf(action, currentPort) || changed
	return changed
}

/** Feedbacks whose id changed in 3.0: the old id, and the new */
export const renamedFeedbacksApi2: Partial<Record<string, string>> = {
	value: 'parameter_property',
}

/**
 * Parameter Value became Parameter Property, its property chosen from a dropdown. Its Return ENUM checkbox became the
 * Value as Enumeration Entry property, which returns the value's entry name (from the enumMap or the enumeration)
 */
function parameterPropertyOf(feedback: CompanionMigrationFeedback): boolean {
	const renamed = renamedFeedbacksApi2[feedback.feedbackId]
	if (!renamed) return false
	feedback.feedbackId = renamed
	feedback.options.property = plain(isTicked(feedback.options.asEnum) ? 'enumeration' : 'value')
	remove(feedback.options, 'asEnum')
	return true
}

function foldFeedback(feedback: CompanionMigrationFeedback): boolean {
	const options = feedback.options
	let changed = false
	if (pathPairsApi2.feedbacks.includes(feedback.feedbackId)) changed = foldPath(options) || changed
	changed = foldNumericPairs(options, numericPairsApi2.feedbacks[feedback.feedbackId]) || changed
	changed = fixupNumbers(options, numericOptionsApi2.feedbacks[feedback.feedbackId]) || changed
	changed = parameterPropertyOf(feedback) || changed
	return changed
}

/**
 * The config options of 3.0. The log level dropdown became the Verbose Logs checkbox: on for the debug and console
 * levels. They showed the module's debug messages, which are now always logged, and at console each registered
 * parameter's contents, which Verbose Logs now logs, with the library's debug output. Connection Variables replaced the
 * actions' Auto Create Variable checkbox: parameter values, so the configured paths keep their variables, and now
 * every parameter in use gets them.
 */
function configApi2(config: EmberPlusConfig | null): EmberPlusConfig | null {
	if (!config) return null
	const { logging, ...rest } = config as LegacyConfig
	if (logging === undefined && typeof rest.verbose === 'boolean' && Array.isArray(rest.variables)) return null
	return {
		...rest,
		verbose: rest.verbose ?? (logging ?? 0) >= LegacyLogLevel.Debug,
		variables: rest.variables ?? ['parameterValues'],
	}
}

function v300(context: Context, props: Props): Result {
	const currentPort = props.config?.port ?? context.currentConfig.port ?? 9000
	return {
		updatedConfig: configApi2(props.config),
		updatedActions: props.actions.filter((action) => foldAction(action, currentPort)),
		updatedFeedbacks: props.feedbacks.filter(foldFeedback),
	}
}

export const UpgradeScripts: CompanionStaticUpgradeScript<EmberPlusConfig>[] = [
	v250,
	v260,
	v270,
	mergeEnumActions,
	v280,
	v300,
]
