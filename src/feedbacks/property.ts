import { createModuleLogger, type DropdownChoice } from '@companion-module/base'
import { Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import { enumEntryName } from '../enums.js'
import { describe } from '../logging.js'

const logger = createModuleLogger('Feedbacks/Parameter Property')

/** The properties of a parameter the Parameter Property feedback returns */
export const ParameterProperty = [
	'value',
	'units',
	'formula',
	'enumeration',
	'identifier',
	'description',
	'parameterType',
	'access',
	'minimum',
	'maximum',
	'defaultValue',
	'factor',
	'format',
	'step',
	'isOnline',
	'streamIdentifier',
	'streamDescriptor',
	'schemaIdentifiers',
	'templateReference',
] as const
export type ParameterProperty = (typeof ParameterProperty)[number]

export const parameterPropertyChoices = [
	{ id: 'value', label: 'Value' },
	{ id: 'units', label: 'Value with Units' },
	{ id: 'formula', label: 'Value by Formula' },
	{ id: 'enumeration', label: 'Value as Enumeration Entry' },
	{ id: 'identifier', label: 'Identifier' },
	{ id: 'description', label: 'Description' },
	{ id: 'parameterType', label: 'Type' },
	{ id: 'access', label: 'Access' },
	{ id: 'minimum', label: 'Minimum' },
	{ id: 'maximum', label: 'Maximum' },
	{ id: 'defaultValue', label: 'Default Value' },
	{ id: 'factor', label: 'Factor' },
	{ id: 'format', label: 'Format' },
	{ id: 'step', label: 'Step' },
	{ id: 'isOnline', label: 'Online' },
	{ id: 'streamIdentifier', label: 'Stream Identifier' },
	{ id: 'streamDescriptor', label: 'Stream Descriptor' },
	{ id: 'schemaIdentifiers', label: 'Schema Identifiers' },
	{ id: 'templateReference', label: 'Template Reference' },
] as const satisfies DropdownChoice<ParameterProperty>[]

/** What the Parameter Property feedback returns: a property of a parameter, null for one it doesn't have */
export type ParameterPropertyValue =
	string | number | boolean | number[] | null | { format: EmberModel.StreamFormat; offset: number }

/** A value or default as JSON: an octet string as its bytes */
function jsonOf(value: EmberTypes.EmberValue | undefined): ParameterPropertyValue {
	if (value === undefined) return null
	return Buffer.isBuffer(value) ? Array.from(value) : value
}

/** A parameter's value as the feedback always gave it: an integer divided by its factor */
function plainValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	const { value } = parameter
	if (parameter.parameterType === EmberModel.ParameterType.Integer && typeof value === 'number') {
		return value / (parameter.factor ?? 1)
	}
	return jsonOf(value)
}

/** The value by the parameter's formula (provider to consumer), or the plain value without one */
function formulaValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	const { formula, value } = parameter
	if (!formula || typeof value !== 'number') return plainValue(parameter)
	const integer =
		parameter.parameterType === EmberModel.ParameterType.Integer ||
		parameter.parameterType === EmberModel.ParameterType.Enum
	try {
		return EmberModel.parseFormula(formula).toDisplay(value, integer ? 'integer' : 'real')
	} catch (e) {
		logger.debug(`Formula ${JSON.stringify(formula)} can't be computed for ${value}: ${describe(e)}`)
		return plainValue(parameter)
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
		const { text, unit } = EmberModel.displayValue(parameter)
		const trimmed = unit?.trim()
		if (!trimmed || !text.endsWith(unit ?? '')) return text
		return `${text.slice(0, text.length - (unit ?? '').length).trimEnd()} ${trimmed}`
	} catch (e) {
		logger.debug(`Value of ${parameter.identifier ?? 'parameter'} can't be displayed: ${describe(e)}`)
		return plainValue(parameter)
	}
}

/**
 * The name of the value's entry, from the enumMap or else the enumeration, as the device names it (a hidden entry with
 * its "~"), or the plain value without one
 */
function enumerationValue(parameter: EmberModel.Parameter): ParameterPropertyValue {
	return enumEntryName(parameter) ?? plainValue(parameter)
}

/** A property of a parameter, as the Parameter Property feedback returns it */
export function parameterProperty(
	parameter: EmberModel.Parameter,
	property: ParameterProperty | undefined,
): ParameterPropertyValue {
	switch (property) {
		case undefined:
		case 'value':
			return plainValue(parameter)
		case 'units':
			return unitsValue(parameter)
		case 'formula':
			return formulaValue(parameter)
		case 'enumeration':
			return enumerationValue(parameter)
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
			return parameter[property] ?? null
		default:
			// A property this version doesn't offer, saved by another
			unhandledProperty(property)
			return plainValue(parameter)
	}
}

/** Exhaustiveness: a property added to ParameterProperty but not handled fails to compile here */
function unhandledProperty(_property: never): void {}
