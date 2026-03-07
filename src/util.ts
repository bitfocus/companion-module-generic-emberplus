import type {
	//CompanionActionContext,
	CompanionActionInfo,
	CompanionFeedbackInfo,
	DropdownChoice,
} from '@companion-module/base'
import { ActionId, type setValueActionOptions } from './actions.js'
import type { EmberPlusConfig } from './config.js'
import type { EmberPlusInstance } from './index.js'
import { EmberPlusState } from './state.js'
import { Model as EmberModel } from 'emberplus-connection'

export function assertUnreachable(_never: never): void {
	// throw new Error('Unreachable')
}

export function literal<T>(val: T): T {
	return val
}

export type Required<T> = T extends object ? { [P in keyof T]-?: NonNullable<T[P]> } : T

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
		return pathString.substring(lastOpenBracket + 1, lastCloseBracket)
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
