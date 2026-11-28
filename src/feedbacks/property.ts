import { createModuleLogger, type DropdownChoice } from '@companion-module/base'
import { Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import { enumEntries, enumEntryName } from '../enums.js'
import { withValidFactor } from '../factor.js'
import { identifierPath } from '../identifiers.js'
import { describe } from '../logging.js'

const logger = createModuleLogger('Feedbacks/Parameter Property')

/** The properties of a parameter the Parameter Property feedback returns */
export const ParameterProperty = [
	'value',
	'units',
	'displayed',
	'enumeration',
	'identifier',
	'identifierPath',
	'description',
	'parameterType',
	'access',
	'minimum',
	'maximum',
	'displayedMinimum',
	'displayedMaximum',
	'defaultValue',
	'factor',
	'format',
	'step',
	'displayedStep',
	'isOnline',
	'streamIdentifier',
	'streamDescriptor',
	'schemaIdentifiers',
	'templateReference',
] as const
export type ParameterProperty = (typeof ParameterProperty)[number]

export const parameterPropertyChoices = [
	{ id: 'value', label: 'Value' },
	{ id: 'displayed', label: 'Value by Formula / Factor' },
	{ id: 'units', label: 'Value with Units' },
	{ id: 'enumeration', label: 'Value as Enumeration Entry' },
	{ id: 'identifier', label: 'Identifier' },
	{ id: 'identifierPath', label: 'Identifier Path' },
	{ id: 'description', label: 'Description' },
	{ id: 'parameterType', label: 'Type' },
	{ id: 'access', label: 'Access' },
	{ id: 'minimum', label: 'Minimum' },
	{ id: 'maximum', label: 'Maximum' },
	{ id: 'displayedMinimum', label: 'Minimum by Formula / Factor' },
	{ id: 'displayedMaximum', label: 'Maximum by Formula / Factor' },
	{ id: 'defaultValue', label: 'Default Value' },
	{ id: 'factor', label: 'Factor' },
	{ id: 'format', label: 'Format' },
	{ id: 'step', label: 'Step' },
	{ id: 'displayedStep', label: 'Step by Formula / Factor' },
	{ id: 'isOnline', label: 'Online' },
	{ id: 'streamIdentifier', label: 'Stream Identifier' },
	{ id: 'streamDescriptor', label: 'Stream Descriptor' },
	{ id: 'schemaIdentifiers', label: 'Schema Identifiers' },
	{ id: 'templateReference', label: 'Template Reference' },
] as const satisfies DropdownChoice<ParameterProperty>[]

/** The properties that read the parameter's value, so change with it: the rest only with what the provider says of it */
const VALUE_PROPERTIES: ReadonlySet<ParameterProperty> = new Set(['value', 'units', 'displayed', 'enumeration'])

/**
 * Properties of 3.0 pre-releases, and the one each became: Value by Formula was merged into Value by Formula / Factor,
 * which it equalled but for edge cases. An upgrade script moves saved feedbacks; this covers a property an expression
 * gives
 */
const mergedProperties: Partial<Record<string, ParameterProperty>> = { formula: 'displayed' }

/** Whether a property changes with the parameter's value (any not known to this version counts as one that does) */
export function readsValue(property: ParameterProperty | undefined): boolean {
	return (
		property === undefined ||
		VALUE_PROPERTIES.has(property) ||
		!(ParameterProperty as readonly string[]).includes(property)
	)
}

/** What the Parameter Property feedback returns: a property of a parameter, null for one it doesn't have */
export type ParameterPropertyValue =
	string | number | boolean | number[] | null | { format: EmberModel.StreamFormat; offset: number }

/** A value or default as JSON: an octet string as its bytes */
function jsonOf(value: EmberTypes.EmberValue | undefined): ParameterPropertyValue {
	if (value === undefined) return null
	return Buffer.isBuffer(value) ? Array.from(value) : value
}

/** A parameter's value as the provider reports it, as JSON: the device value, with no formula or factor applied */
function reportedValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	return jsonOf(parameter.value)
}

/**
 * A number's value by the parameter's formula, or else divided by its factor (the library's displayValue, a factor
 * only if it is a positive whole number), as Set Value Integer and Real take it and the parameter variables give it.
 * An enumeration's value is its number. A formula that can't be computed gives the reported value, as does a value that
 * isn't a number.
 */
function displayedValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	if (typeof parameter.value !== 'number') return reportedValue(parameter)
	try {
		const { value } = EmberModel.displayValue(withValidFactor(parameter))
		return typeof value === 'number' ? value : reportedValue(parameter)
	} catch (e) {
		logger.debug(`Value of ${parameter.identifier ?? 'parameter'} can't be displayed: ${describe(e)}`)
		return reportedValue(parameter)
	}
}

/**
 * The value by formula or factor, as its format gives it, with the unit: the library's display text, which keeps the
 * format's text after the "°" that marks the unit. One space goes between the number and the unit, whether the
 * format had one ("%.1f°dB" and "%.1f° dB" both give "-12.5 dB")
 */
function unitsValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	if (parameter.value === undefined || parameter.value === null) return null
	// An enumeration's entry, named as the device names it: the library's display text drops a hidden entry's "~"
	if (parameter.parameterType === EmberModel.ParameterType.Enum) {
		const name = enumEntryName(parameter)
		if (name !== undefined) return name
	}
	try {
		const { text, unit } = EmberModel.displayValue(withValidFactor(parameter))
		const trimmed = unit?.trim()
		if (!trimmed || !text.endsWith(unit ?? '')) return text
		return `${text.slice(0, text.length - (unit ?? '').length).trimEnd()} ${trimmed}`
	} catch (e) {
		logger.debug(`Value of ${parameter.identifier ?? 'parameter'} can't be displayed: ${describe(e)}`)
		return reportedValue(parameter)
	}
}

/**
 * The name of the value's entry, from the enumMap or else the enumeration, as the device names it (a hidden entry with
 * its "~"), or the reported value without one
 */
function enumerationValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	return enumEntryName(parameter) ?? reportedValue(parameter)
}

/**
 * A number in the parameter's displayed units: by its formula, or else its factor (a positive whole number), as the Set
 * Value actions take it.
 * Undefined for one the formula can't compute.
 */
export function displayedNumberOf(parameter: EmberModel.Parameter, value: number): number | undefined {
	try {
		const shown = EmberModel.displayValue(withValidFactor(parameter), value).value
		return typeof shown === 'number' && Number.isFinite(shown) ? shown : undefined
	} catch {
		return undefined
	}
}

/**
 * A parameter's range as displayed, lower first. An integer's or real's limits by its formula, or else factor (a
 * formula may turn them round); an enumeration's minimum and maximum, or else its first and last entry's value (its
 * entries give its range where it states none). Undefined for a parameter without both, a formula that can't compute
 * them, or a range of nothing.
 */
export function displayedRange(parameter: EmberModel.Parameter): [number, number] | undefined {
	if (parameter.parameterType === EmberModel.ParameterType.Enum) {
		const values = enumEntries(parameter).map((entry) => entry.value)
		const low =
			typeof parameter.minimum === 'number' ? parameter.minimum : values.length ? Math.min(...values) : undefined
		const high =
			typeof parameter.maximum === 'number' ? parameter.maximum : values.length ? Math.max(...values) : undefined
		return low === undefined || high === undefined || low >= high ? undefined : [low, high]
	}
	if (
		parameter.parameterType !== EmberModel.ParameterType.Integer &&
		parameter.parameterType !== EmberModel.ParameterType.Real
	) {
		return undefined
	}
	const { minimum, maximum } = parameter
	if (typeof minimum !== 'number' || typeof maximum !== 'number') return undefined
	const [low, high] = [displayedNumberOf(parameter, minimum), displayedNumberOf(parameter, maximum)]
	if (low === undefined || high === undefined || low === high) return undefined
	return [Math.min(low, high), Math.max(low, high)]
}

/**
 * An integer's or real's step as displayed: its own step, an integer's being 1 unless it says otherwise, by formula or
 * factor, as the difference it makes from its minimum. Undefined for a real without one, or anything else.
 */
export function displayedStep(parameter: EmberModel.Parameter): number | undefined {
	const integer = parameter.parameterType === EmberModel.ParameterType.Integer
	if (!integer && parameter.parameterType !== EmberModel.ParameterType.Real) return undefined
	const own = parameter.step ?? (integer ? 1 : undefined)
	if (own === undefined) return undefined
	const origin = typeof parameter.minimum === 'number' ? parameter.minimum : 0
	const [from, to] = [displayedNumberOf(parameter, origin), displayedNumberOf(parameter, origin + own)]
	if (from === undefined || to === undefined || from === to) return undefined
	return Number(Math.abs(to - from).toPrecision(12))
}

/**
 * A property of a parameter, as the Parameter Property feedback returns it. Its path by identifiers needs its element
 * in the library's tree, for the nodes above it; without one, it is the parameter's own identifier.
 */
export function parameterProperty(
	parameter: EmberModel.Parameter,
	property: ParameterProperty | undefined,
	element?: EmberModel.TreeElement<EmberModel.EmberElement>,
): ParameterPropertyValue {
	const chosen = mergedProperties[String(property)] ?? property
	switch (chosen) {
		case undefined:
		case 'value':
			return reportedValue(parameter)
		case 'units':
			return unitsValue(parameter)
		case 'displayed':
			return displayedValue(parameter)
		case 'enumeration':
			return enumerationValue(parameter)
		case 'identifierPath':
			return element ? identifierPath(element, parameter.identifier ?? '') : (parameter.identifier ?? null)
		case 'displayedMinimum':
			return displayedRange(parameter)?.[0] ?? null
		case 'displayedMaximum':
			return displayedRange(parameter)?.[1] ?? null
		case 'displayedStep':
			return displayedStep(parameter) ?? null
		case 'defaultValue':
			return jsonOf(parameter.defaultValue)
		case 'streamDescriptor': {
			const descriptor = parameter.streamDescriptor
			return descriptor ? { format: descriptor.format, offset: descriptor.offset } : null
		}
		case 'identifier':
		case 'description':
		case 'parameterType':
		case 'access':
		case 'minimum':
		case 'maximum':
		case 'factor':
		case 'format':
		case 'step':
		case 'isOnline':
		case 'streamIdentifier':
		case 'schemaIdentifiers':
		case 'templateReference':
			return parameter[chosen] ?? null
		default:
			// A property this version doesn't offer, saved by another
			unhandledProperty(chosen)
			return reportedValue(parameter)
	}
}

/** Exhaustiveness: a property added to ParameterProperty but not handled fails to compile here */
function unhandledProperty(_property: never): void {}
