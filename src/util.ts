import type {
	CompanionActionContext,
	CompanionActionInfo,
	CompanionFeedbackInfo,
	DropdownChoice,
} from '@companion-module/base'
import { EmberPlusState } from './state'
import { Model as EmberModel } from 'emberplus-connection'
import type { CompanionCommonCallbackContext } from '@companion-module/base/dist/module-api/common'

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
					choices.push({ id: path, label: label })
				}
			}
		})
	}
	return choices
}

/**
 * Returns the current enumeration string of the parameter
 */

export function getCurrentEnumValue(state: EmberPlusState, path: string): string {
	return state.parameters.get(path)?.enumeration?.split('\n')[Number(state.parameters.get(path)?.value)] ?? ''
}

/**
 * Returns the index value of enum string
 */

export function getEnumIndex(state: EmberPlusState, path: string, enumStr: string): number | undefined {
	return state.parameters.get(path)?.enumeration?.split('\n').indexOf(enumStr)
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

export async function calcRelativeNumber(
	value: number,
	path: string,
	min: string,
	max: string,
	type: EmberModel.ParameterType,
	context: CompanionActionContext,
	state: EmberPlusState,
): Promise<number> {
	let oldValue = Number(state.parameters.get(path)?.value)
	if (isNaN(oldValue)) oldValue = 0
	let newValue = value + oldValue
	const minLimit = Number(await context.parseVariablesInString(min))
	const maxLimit = Number(await context.parseVariablesInString(max))
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

export async function resolvePath(context: CompanionCommonCallbackContext, path: string): Promise<string> {
	const pathString: string = (await context.parseVariablesInString(path)).replaceAll('/', '.')
	if (pathString.includes('[') && pathString.includes(']')) {
		return pathString.substring(pathString.indexOf('[') + 1, pathString.indexOf(']'))
	}
	return pathString
}

export async function resolveEventPath(
	event: CompanionFeedbackInfo | CompanionActionInfo,
	context: CompanionCommonCallbackContext,
): Promise<string> {
	return await resolvePath(
		context,
		event.options['usePathVar']
			? (event.options['pathVar']?.toString() ?? '')
			: (event.options['path']?.toString() ?? ''),
	)
}
