import type {
	//CompanionActionContext,
	CompanionActionInfo,
	CompanionFeedbackInfo,
	DropdownChoice,
} from '@companion-module/base'

export enum NumberComparitor {
	Equal = 'eq',
	NotEqual = 'ne',
	LessThan = 'lt',
	LessThanEqual = 'lte',
	GreaterThan = 'gt',
	GreaterThanEqual = 'gte',
}

export const comparitorOptions: DropdownChoice[] = [
	{ id: NumberComparitor.Equal, label: '==' },
	{ id: NumberComparitor.NotEqual, label: '!=' },
	{ id: NumberComparitor.LessThan, label: '<' },
	{ id: NumberComparitor.LessThanEqual, label: '<=' },
	{ id: NumberComparitor.GreaterThan, label: '>' },
	{ id: NumberComparitor.GreaterThanEqual, label: '>=' },
]

import { ActionId, type setValueActionOptions } from './actions.js'
import type { EmberPlusConfig } from './config.js'
import type { EmberPlusInstance } from './index.js'
import { EmberPlusState } from './state.js'
import { Model as EmberModel } from 'emberplus-connection'
import { ElementType } from 'emberplus-connection/dist/model/index.js'
import type { EmberTypedValue } from 'emberplus-connection/dist/types/index.js'
import type { FunctionArgument } from 'emberplus-connection/dist/model/FunctionArgument.js'

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
): DropdownChoice[] {
	const choices: DropdownChoice[] = []
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
 * Conform numeric value to range defined by min and max
 */

export function checkNumberLimits(value: number, min: number, max: number): number {
	return value > max ? max : value < min ? min : value
}

/**
 * Calculate absloute numeric value from relative action
 */

export function calcRelativeNumber(
	value: number,
	path: string,
	min: string,
	max: string,
	type: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real | EmberModel.ParameterType.Enum,
	state: EmberPlusState,
): number {
	let oldValue = Number(state.parameters.get(path)?.value)
	if (isNaN(oldValue)) oldValue = 0
	let newValue = value + oldValue
	const minLimit = min.trim() === '' ? NaN : Number(min)
	const maxLimit = max.trim() === '' ? NaN : Number(max)
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

export function resolveEventPath(event: CompanionFeedbackInfo | CompanionActionInfo): string {
	return resolvePath(
		event.options['usePathVar']
			? (event.options['pathVar']?.toString() ?? '')
			: (event.options['path']?.toString() ?? ''),
	)
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

export function recordParameterAction(
	path: string,
	actionType: ActionId,
	value: boolean | number | string,
	self: EmberPlusInstance,
	state: EmberPlusState,
): void {
	const param = state.parameters.get(path)

	const actOptions: setValueActionOptions = {
		path: path,
		pathVar: path,
		usePathVar: false,
		value: value,
		variable: true,
	}

	switch (actionType) {
		case ActionId.SetValueBoolean:
			actOptions.useVar = false
			actOptions.valueVar = value.toString()
			actOptions.toggle = false
			break

		case ActionId.SetValueEnum:
			actOptions.useVar = false
			actOptions.valueVar = value.toString()
			actOptions.relative = false
			actOptions.min = param?.minimum?.toString() ?? '0'
			actOptions.max = param?.maximum?.toString() ?? ''
			actOptions.asEnum = true
			actOptions.enumValue = state.getCurrentEnumValue(path)
			break

		case ActionId.SetValueInt:
			actOptions.useVar = false
			actOptions.valueVar = value.toString()
			actOptions.relative = false
			actOptions.min = param?.minimum?.toString() ?? ''
			actOptions.max = param?.maximum?.toString() ?? ''
			actOptions.factor = param?.factor?.toString() ?? '1'
			break

		case ActionId.SetValueReal:
			actOptions.useVar = false
			actOptions.valueVar = value.toString()
			actOptions.relative = false
			actOptions.min = param?.minimum?.toString() ?? ''
			actOptions.max = param?.maximum?.toString() ?? ''
			break

		case ActionId.SetValueString:
			actOptions.parseEscapeChars = false
			break

		default:
			return
	}

	self.recordAction(
		{
			actionId: actionType,
			options: actOptions,
		},
		path,
	)
}

export function parseParameterValue(
	path: string,
	contents: EmberModel.Parameter,
	state: EmberPlusState,
): { actionType: ActionId | undefined; value: boolean | number | string } {
	let value: boolean | number | string
	let actionType: ActionId | undefined

	switch (contents.parameterType) {
		case EmberModel.ParameterType.Boolean:
			actionType = ActionId.SetValueBoolean
			value = contents.value as boolean
			break
		case EmberModel.ParameterType.Integer:
			actionType = ActionId.SetValueInt
			value = Number(contents.value) / (state.parameters.get(path)?.factor ?? 1)
			break
		case EmberModel.ParameterType.Real:
			actionType = ActionId.SetValueReal
			value = contents.value as number
			break
		case EmberModel.ParameterType.Enum:
			actionType = ActionId.SetValueEnum
			value = contents.value as number
			break
		case EmberModel.ParameterType.String:
			actionType = ActionId.SetValueString
			value = substituteEscapeCharacters(contents.value as string)
			break
		default:
			value = contents.value as string
	}

	return { actionType, value }
}

/**
 * Return array of dropdown choices of registered Ember+ functions
 */
export function filterFunctionPathChoices(state: EmberPlusState): DropdownChoice[] {
	const choices: DropdownChoice[] = []
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

/**
 * Parse raw input arguments string into EmberTypedValue array for Ember+ function invocation.
 * Handles JSON array input, comma/line separated lists, and schema-based type casting.
 */
export function parseFunctionArguments(
	rawArgsString: string,
	expectedArgs?: FunctionArgument[],
): EmberTypedValue[] {
	const trimmed = rawArgsString.trim()
	if (!trimmed) return []

	// Try JSON parsing if argument input looks like a JSON array
	if (trimmed.startsWith('[')) {
		try {
			const jsonParsed = JSON.parse(trimmed)
			if (Array.isArray(jsonParsed)) {
				return jsonParsed.map((item, idx) => {
					// Check if item is already an EmberTypedValue object ({ type, value })
					if (typeof item === 'object' && item !== null && 'type' in item && 'value' in item) {
						return item as EmberTypedValue
					}

					const expected = expectedArgs?.[idx]
					if (expected) {
						return castToEmberTypedValue(item, expected.type)
					}

					if (typeof item === 'boolean') {
						return { type: EmberModel.ParameterType.Boolean, value: item }
					}
					if (typeof item === 'number') {
						return {
							type: Number.isInteger(item) ? EmberModel.ParameterType.Integer : EmberModel.ParameterType.Real,
							value: item,
						}
					}
					return { type: EmberModel.ParameterType.String, value: String(item) }
				})
			}
		} catch {
			// Fallback to comma/line separation if JSON parsing fails
		}
	}

	// Split by newline or comma
	const tokens = trimmed.split(/[\n,]+/).map((t) => t.trim()).filter((t) => t.length > 0)

	return tokens.map((token, idx) => {
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

function castToEmberTypedValue(value: any, targetType: EmberModel.ParameterType): EmberTypedValue {
	switch (targetType) {
		case EmberModel.ParameterType.Boolean:
			return { type: targetType, value: Boolean(value) }
		case EmberModel.ParameterType.Integer:
		case EmberModel.ParameterType.Enum:
			return { type: targetType, value: Math.round(Number(value)) }
		case EmberModel.ParameterType.Real:
			return { type: targetType, value: Number(value) }
		case EmberModel.ParameterType.String:
		default:
			return { type: targetType, value: String(value) }
	}
}

function castStringToType(token: string, targetType: EmberModel.ParameterType): EmberTypedValue {
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
		case EmberModel.ParameterType.String:
		default:
			return { type: targetType, value: token }
	}
}

/**
 * Recursively discover Function nodes from an Ember+ tree collection.
 */
export function discoverFunctionsFromTree(nodes: any, state: EmberPlusState, parentPath = ''): void {
	if (!nodes) return
	const elements = Array.isArray(nodes) ? nodes : Object.values(nodes)

	for (const node of elements) {
		if (!node || typeof node !== 'object') continue
		const num = node.number ?? node.path
		const currentPath = parentPath && num !== undefined ? `${parentPath}.${num}` : `${num ?? ''}`

		if (node.contents?.type === ElementType.Function && currentPath) {
			state.updateFunctionMap(currentPath, node)
		}

		if (node.children) {
			discoverFunctionsFromTree(node.children, state, currentPath)
		}
	}
}
