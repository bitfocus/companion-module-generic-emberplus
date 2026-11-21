import { Regex } from '@companion-module/base'
import type { DropdownChoice } from '@companion-module/base'

export enum NumberComparitor {
	Equal = 'eq',
	NotEqual = 'ne',
	LessThan = 'lt',
	LessThanEqual = 'lte',
	GreaterThan = 'gt',
	GreaterThanEqual = 'gte',
}

export const comparitorOptions = [
	{ id: NumberComparitor.Equal, label: '==' },
	{ id: NumberComparitor.NotEqual, label: '!=' },
	{ id: NumberComparitor.LessThan, label: '<' },
	{ id: NumberComparitor.LessThanEqual, label: '<=' },
	{ id: NumberComparitor.GreaterThan, label: '>' },
	{ id: NumberComparitor.GreaterThanEqual, label: '>=' },
] as const satisfies DropdownChoice<NumberComparitor>[]

import { ActionId, type SetValueOptions } from './actions.js'
import type { EmberPlusConfig } from './config.js'
import type EmberPlusInstance from './index.js'
import { EmberNumberRange, type NumericParameterType } from './ranges.js'
import { EmberPlusState } from './state.js'
import { Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'

export function assertUnreachable(_never: never): void {
	// throw new Error('Unreachable')
}

export function literal<T>(val: T): T {
	return val
}

export type Required<T> = T extends object ? { [P in keyof T]-?: NonNullable<T[P]> } : T

export function compareNumber(target: number, comparitor: NumberComparitor, currentValue: number): boolean {
	const targetValue = Number(target)
	if (isNaN(targetValue)) {
		return false
	}
	switch (comparitor) {
		case NumberComparitor.GreaterThan:
			return currentValue > targetValue
		case NumberComparitor.GreaterThanEqual:
			return currentValue >= targetValue
		case NumberComparitor.LessThan:
			return currentValue < targetValue
		case NumberComparitor.LessThanEqual:
			return currentValue <= targetValue
		case NumberComparitor.NotEqual:
			return currentValue != targetValue
		case NumberComparitor.Equal:
		default:
			return currentValue === targetValue
	}
}

/**
 * Parse common escape characters in strings passed to callback from action or feedback options.
 * This is useful to ensure \r, \n etc are represented as such rather than as \\r, \\n
 */

export function parseEscapeCharacters(msg: string): string {
	const message = msg
		.replaceAll('\\n', '\n')
		.replaceAll('\\r', '\r')
		.replaceAll('\\t', '\t')
		.replaceAll('\\f', '\f')
		.replaceAll('\\v', '\v')
		.replaceAll('\\b', '\b')
		.replaceAll('\\x00', '\x00')
		.replaceAll('\\x01', '\x01')
		.replaceAll('\\x02', '\x02')
		.replaceAll('\\x03', '\x03')
	return message
}

/**
 * The reverse of parseEscapeCharacters. This is useful to to ensure special charaters are displayed normally when returned to the UI.
 * Ie during a learn callback, or as a variable
 */

export function substituteEscapeCharacters(msg: string): string {
	const message = msg
		.replaceAll('\n', '\\n')
		.replaceAll('\r', '\\r')
		.replaceAll('\t', '\\t')
		.replaceAll('\f', '\\f')
		.replaceAll('\v', '\\v')
		.replaceAll('\b', '\\b')
		.replaceAll('\x00', '\\x00')
		.replaceAll('\x01', '\\x01')
		.replaceAll('\x02', '\\x02')
		.replaceAll('\x03', '\\x03')
	return message
}

/**
 * Return array of dropdown choices of registered paths of the specified parameter type(s)
 */

export function filterPathChoices(
	state: EmberPlusState,
	isWriteable: boolean,
	...paramFilter: EmberModel.ParameterType[]
): DropdownChoice<string>[] {
	const choices: DropdownChoice<string>[] = []
	//If not filter specified allow all types
	if (paramFilter.length === 0) {
		paramFilter = Object.values(EmberModel.ParameterType)
	}
	for (const [path, value] of state.parameters) {
		let label = `${path}`

		paramFilter.forEach((element) => {
			if (element === value.parameterType) {
				if (value.identifier) {
					label += `: ${value.identifier}`
				}
				if (value.description) {
					label += ` (${value.description})`
				}
				if (isWriteable) {
					if (
						value.access === EmberModel.ParameterAccess.ReadWrite ||
						value.access === EmberModel.ParameterAccess.Write
					) {
						choices.push({ id: path, label: label })
					}
				} else {
					if (value.access !== EmberModel.ParameterAccess.None) choices.push({ id: path, label: label })
				}
			}
		})
	}
	return choices
}

/**
 * Whether a parameter is a stream parameter, such as a meter: one with a stream identifier, whose values a provider sends
 * in stream collections, and only to consumers that subscribed to it
 */
export function isStreamParameter(parameter: EmberModel.Parameter | undefined): boolean {
	return parameter?.streamIdentifier !== undefined
}

/**
 * A number parameter's value as it is displayed: by its formula, or else divided by its factor (the library's
 * displayValue). Undefined for a value that isn't a number, or none at present. Throws FormulaError for a formula that
 * can't be computed.
 */
export function displayedNumber(parameter: EmberModel.Parameter | undefined): number | undefined {
	if (!parameter) return undefined
	const { value } = EmberModel.displayValue(parameter)
	return typeof value === 'number' ? value : undefined
}

/**
 * Conform numeric value to range defined by min and max
 */

export function checkNumberLimits(value: number, min: number, max: number): number {
	return value > max ? max : value < min ? min : value
}

/**
 * Calculate absloute numeric value from relative action. The limits are numbers; one missing (an action saved without
 * it) is no limit.
 */

export function calcRelativeNumber(
	value: number,
	path: string,
	min: number | undefined,
	max: number | undefined,
	type: NumericParameterType,
	state: EmberPlusState,
): number {
	let oldValue = Number(state.parameters.get(path)?.value)
	if (isNaN(oldValue)) oldValue = 0
	let newValue = value + oldValue
	const minLimit = Number(min ?? NaN)
	const maxLimit = Number(max ?? NaN)
	if (type === EmberModel.ParameterType.Integer) {
		newValue = Math.round(newValue)
	}
	if (type === EmberModel.ParameterType.Enum) {
		newValue = Math.round(newValue)
		newValue = newValue < 0 ? 0 : newValue
	}
	if (!isNaN(minLimit)) newValue = newValue < minLimit ? minLimit : newValue
	if (!isNaN(maxLimit)) newValue = newValue > maxLimit ? maxLimit : newValue
	return newValue
}

export function resolvePath(path: string): string {
	const pathString: string = path.replaceAll('/', '.').trim()
	const lastOpenBracket = pathString.lastIndexOf('[')
	const lastCloseBracket = pathString.lastIndexOf(']')

	// Check if both brackets exist and close bracket comes after open bracket
	if (lastOpenBracket !== -1 && lastCloseBracket !== -1 && lastCloseBracket > lastOpenBracket) {
		const candidate = pathString.substring(lastOpenBracket + 1, lastCloseBracket)
		if (/^\d+(\.\d+)*$/.test(candidate)) {
			return candidate
		}
	}

	return pathString
}

/** The path of an action or feedback. Companion has already resolved it when the field is an expression */
export function resolveEventPath(event: { readonly options: { readonly path?: string } }): string {
	return resolvePath(event.options.path?.toString() ?? '')
}

/**
 * Remove illegal characters from variable id
 */

export const sanitiseVariableId = (id: string, substitute: '' | '.' | '-' | '_' = '_'): string =>
	id.replaceAll(/[^a-zA-Z0-9-_.]/gm, substitute)

/**
 * Utility check that a value exists
 */

export const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

export function parseBonjourHost(config: EmberPlusConfig): [string, number] {
	if (!config.bonjourHost) return [config.host ?? '', config.port ?? 9000]

	const [host, port] = config.bonjourHost.split(':')
	const parsedPort = Number.parseInt(port)

	return [host, Number.isNaN(parsedPort) ? 9000 : parsedPort]
}

export function hasConnectionChanged(oldConfig: EmberPlusConfig, newConfig: EmberPlusConfig): boolean {
	return newConfig.host !== oldConfig.host || newConfig.port !== oldConfig.port
}

/**
 * Check a hostname or IP is plausible. Regex.HOSTNAME is a delimited string, so the delimiters are stripped
 */

export function isValidHostname(host: string): boolean {
	return new RegExp(Regex.HOSTNAME.slice(1, -1)).test(host)
}

export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 0xffff
}

/**
 * The value a recorded action sets: a number as it is displayed, by the parameter's formula or factor, which the action
 * converts back; anything else as it is. A formula that can't be computed leaves the value as it is.
 */
function actionValue(
	actionType: ActionId,
	value: boolean | number | string,
	parameter: EmberModel.Parameter | undefined,
): boolean | number | string {
	if (actionType !== ActionId.SetValueInt && actionType !== ActionId.SetValueReal) return value
	try {
		return displayedNumber(parameter) ?? value
	} catch {
		return value
	}
}

export function recordParameterAction(
	path: string,
	actionType: ActionId,
	value: boolean | number | string,
	self: EmberPlusInstance,
	state: EmberPlusState,
): void {
	const param = state.parameters.get(path)

	// A recorded action isn't relative, but the user may turn it so: give it the parameter's limits, else none
	const limits = (type: NumericParameterType): SetValueOptions => ({
		relative: false,
		min: param?.minimum ?? EmberNumberRange[type].min,
		max: param?.maximum ?? EmberNumberRange[type].max,
	})

	let typeOptions: SetValueOptions
	switch (actionType) {
		case ActionId.SetValueBoolean:
			typeOptions = { toggle: false }
			break
		case ActionId.SetValueInt:
			typeOptions = limits(EmberModel.ParameterType.Integer)
			break
		case ActionId.SetValueReal:
			typeOptions = limits(EmberModel.ParameterType.Real)
			break
		case ActionId.SetValueEnum:
			typeOptions = {
				...limits(EmberModel.ParameterType.Enum),
				asEnum: true,
				enumValue: state.getCurrentEnumValue(path),
			}
			break
		case ActionId.SetValueString:
			typeOptions = { parseEscapeChars: false }
			break
		default:
			return
	}

	const actOptions: SetValueOptions = { path, value: actionValue(actionType, value, param), ...typeOptions }

	self.recordAction(
		{
			actionId: actionType,
			options: actOptions,
		},
		path,
	)
}

/**
 * The action that sets a parameter of its type, for the action recorder, and its value: a number as the device has it
 * (the recorder gives the action the displayed value, by the library's displayValue), a string with its control
 * characters written out. A value may be null (Glow 2.50: none at present), which keeps the parameter's type; so may one
 * a report left out. A parameter of another type has no action.
 */
export function parseParameterValue(contents: EmberModel.Parameter): {
	actionType: ActionId | undefined
	value: boolean | number | string | null
} {
	switch (contents.parameterType) {
		case EmberModel.ParameterType.Boolean:
			return { actionType: ActionId.SetValueBoolean, value: contents.value ?? null }
		case EmberModel.ParameterType.Integer:
			return { actionType: ActionId.SetValueInt, value: contents.value ?? null }
		case EmberModel.ParameterType.Real:
			return { actionType: ActionId.SetValueReal, value: contents.value ?? null }
		case EmberModel.ParameterType.Enum:
			return { actionType: ActionId.SetValueEnum, value: contents.value ?? null }
		case EmberModel.ParameterType.String:
			return {
				actionType: ActionId.SetValueString,
				value: isDefined(contents.value) ? substituteEscapeCharacters(contents.value) : null,
			}
		default:
			return { actionType: undefined, value: null }
	}
}

/**
 * Return array of dropdown choices of registered Ember+ functions
 */
export function filterFunctionPathChoices(state: EmberPlusState): DropdownChoice<string>[] {
	const choices: DropdownChoice<string>[] = []
	for (const [path, func] of state.functions) {
		let label = `${path}`
		if (func.identifier) {
			label += `: ${func.identifier}`
		}
		if (func.description) {
			label += ` (${func.description})`
		}
		choices.push({ id: path, label })
	}
	return choices
}

/** Whether a value is a typed value as the library takes one: a parameter type, and a value of its form */
function isEmberTypedValue(item: unknown): item is EmberTypes.EmberTypedValue {
	if (typeof item !== 'object' || item === null || !('type' in item) || !('value' in item)) return false
	const { type, value } = item
	const types: unknown[] = Object.values(EmberModel.ParameterType)
	return types.includes(type) && EmberModel.isValueOfType(type as EmberModel.ParameterType, value)
}

/**
 * Parse raw input arguments string into EmberTypedValue array for Ember+ function invocation.
 * Handles JSON array input, comma/line separated lists, and schema-based type casting.
 */
export function parseFunctionArguments(
	rawArgsString: string,
	expectedArgs?: EmberModel.FunctionArgument[],
): EmberTypes.EmberTypedValue[] {
	const trimmed = rawArgsString.trim()
	if (!trimmed) return []

	// Try JSON parsing if argument input looks like a JSON array
	if (trimmed.startsWith('[')) {
		try {
			const jsonParsed: unknown = JSON.parse(trimmed)
			if (Array.isArray(jsonParsed)) {
				return jsonParsed.map((item: unknown, idx): EmberTypes.EmberTypedValue => {
					// An item given as a typed value ({ type, value }) is taken as it is, if its value fits its type
					if (isEmberTypedValue(item)) return item

					const expected = expectedArgs?.[idx]
					if (expected) {
						return castToEmberTypedValue(item, expected.type)
					}

					if (typeof item === 'boolean') {
						return { type: EmberModel.ParameterType.Boolean, value: item }
					}
					if (typeof item === 'number') {
						return Number.isInteger(item)
							? { type: EmberModel.ParameterType.Integer, value: item }
							: { type: EmberModel.ParameterType.Real, value: item }
					}
					return { type: EmberModel.ParameterType.String, value: textOf(item) }
				})
			}
		} catch {
			// Fallback to comma/line separation if JSON parsing fails
		}
	}

	// Split by newline or comma
	const tokens = trimmed
		.split(/[\n,]+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0)

	return tokens.map((token, idx): EmberTypes.EmberTypedValue => {
		const expected = expectedArgs?.[idx]
		if (expected) {
			return castStringToType(token, expected.type)
		}

		// Infer type if schema argument is not available
		if (token.toLowerCase() === 'true') return { type: EmberModel.ParameterType.Boolean, value: true }
		if (token.toLowerCase() === 'false') return { type: EmberModel.ParameterType.Boolean, value: false }
		if (/^-?\d+$/.test(token)) return { type: EmberModel.ParameterType.Integer, value: Number.parseInt(token, 10) }
		if (/^-?\d+\.\d+$/.test(token)) return { type: EmberModel.ParameterType.Real, value: Number.parseFloat(token) }

		return { type: EmberModel.ParameterType.String, value: token }
	})
}

/** A JSON value as text: a string as it is, anything else as JSON */
function textOf(value: unknown): string {
	return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * A JSON value as an argument of the type the function declares. The library refuses a value that doesn't fit its
 * type, so each type gets a value of its form: an octet string the text's UTF-8 bytes, a null argument null.
 */
function castToEmberTypedValue(value: unknown, targetType: EmberModel.ParameterType): EmberTypes.EmberTypedValue {
	switch (targetType) {
		case EmberModel.ParameterType.Boolean:
			return { type: targetType, value: Boolean(value) }
		case EmberModel.ParameterType.Integer:
		case EmberModel.ParameterType.Enum:
			return { type: targetType, value: Math.round(Number(value)) }
		case EmberModel.ParameterType.Real:
			return { type: targetType, value: Number(value) }
		case EmberModel.ParameterType.Octets:
			return { type: targetType, value: Buffer.from(textOf(value)) }
		case EmberModel.ParameterType.Null:
			return { type: targetType, value: null }
		case EmberModel.ParameterType.Trigger:
			return {
				type: targetType,
				value: typeof value === 'number' || typeof value === 'boolean' ? value : textOf(value),
			}
		case EmberModel.ParameterType.String:
			return { type: targetType, value: textOf(value) }
		default:
			assertUnreachable(targetType)
			return { type: EmberModel.ParameterType.String, value: textOf(value) }
	}
}

/** A token of a comma or line separated list as an argument of the type the function declares */
function castStringToType(token: string, targetType: EmberModel.ParameterType): EmberTypes.EmberTypedValue {
	switch (targetType) {
		case EmberModel.ParameterType.Boolean:
			return {
				type: targetType,
				value: token.toLowerCase() === 'true' || token === '1',
			}
		case EmberModel.ParameterType.Integer:
		case EmberModel.ParameterType.Enum: {
			const parsed = Number.parseInt(token, 10)
			return { type: targetType, value: Number.isNaN(parsed) ? 0 : parsed }
		}
		case EmberModel.ParameterType.Real: {
			const parsed = Number.parseFloat(token)
			return { type: targetType, value: Number.isNaN(parsed) ? 0 : parsed }
		}
		case EmberModel.ParameterType.Octets:
			return { type: targetType, value: Buffer.from(token) }
		case EmberModel.ParameterType.Null:
			return { type: targetType, value: null }
		case EmberModel.ParameterType.Trigger:
		case EmberModel.ParameterType.String:
			return { type: targetType, value: token }
		default:
			assertUnreachable(targetType)
			return { type: EmberModel.ParameterType.String, value: token }
	}
}

/**
 * Recursively discover Function nodes from an Ember+ tree: the client's tree, or an element's children, by number.
 */
export function discoverFunctionsFromTree(
	nodes: EmberModel.Children | undefined,
	state: EmberPlusState,
	parentPath = '',
): void {
	if (!nodes) return

	for (const node of nodes.values()) {
		const currentPath = parentPath ? `${parentPath}.${node.number}` : `${node.number}`

		if (node.contents.type === EmberModel.ElementType.Function) {
			state.updateFunctionMap(currentPath, node)
		}

		if (node.children) {
			discoverFunctionsFromTree(node.children, state, currentPath)
		}
	}
}
