import type { DropdownChoice } from '@companion-module/base'
import { EmberPlusState } from './state'
import type { Model as EmberModel } from 'emberplus-connection'

export const MEDIA_PLAYER_SOURCE_CLIP_OFFSET = 1000

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
		.replaceAll('\\\\', '\\')
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
		.replaceAll('\\', '\\\\')
	return message
}

/**
 * Return array of dropdown choices of registered paths of the specified parameter type(s)
 */

export function filterPathChoices(state: EmberPlusState, ...paramFilter: EmberModel.ParameterType[]): DropdownChoice[] {
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
				choices.push({ id: path, label: label })
			}
		})
	}
	return choices
}
