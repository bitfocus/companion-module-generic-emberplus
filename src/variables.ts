import type { CompanionVariableDefinitions, CompanionVariableValue } from '@companion-module/base'
import type { EmberPlusState } from './state.js'
import { displayedNumber, isStreamParameter, sanitiseVariableId, substituteEscapeCharacters } from './util.js'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'

/** Which parameters get variables, from the Connection Variables config option */
export interface ParameterVariables {
	/** Parameter - Values: parameters other than streams */
	values: boolean
	/** Parameter - Streams: stream parameters, such as meters */
	streams: boolean
}

/** Whether a parameter gets variables: a stream parameter with Parameter - Streams, any other with Parameter - Values */
export function hasParameterVariables(parameter: EmberModel.Parameter | undefined, kinds: ParameterVariables): boolean {
	return isStreamParameter(parameter) ? kinds.streams : kinds.values
}

/**
 * The connection's variables: host and port, then one per monitored parameter that gets variables (two for an enum),
 * sorted by id. The monitored parameters are the configured paths and every parameter an action or feedback uses. A
 * path not yet loaded counts as no stream.
 */
export function GetVariablesList(state: EmberPlusState, kinds: ParameterVariables): CompanionVariableDefinitions {
	const variables: CompanionVariableDefinitions = {
		host: { name: 'Connection Host' },
		port: { name: 'Connection Port' },
	}
	if (!kinds.values && !kinds.streams) return variables

	const parameterVariables = Array.from(state.monitoredParameters).flatMap((path) => {
		const parameter = state.parameters.get(path)
		if (!hasParameterVariables(parameter, kinds)) return []
		const id = sanitiseVariableId(path)
		let name = path
		if (parameter?.identifier) name += `: ${parameter.identifier}`
		if (parameter?.description) name += ` (${parameter.description})`
		if (parameter?.parameterType === EmberModel.ParameterType.Enum) {
			return [
				{ id, name },
				{ id: `${id}_ENUM`, name: `ENUM: ${name}` },
			]
		}
		return [{ id, name }]
	})

	for (const { id, name } of parameterVariables.sort((a, b) => a.id.localeCompare(b.id))) {
		variables[id] = { name }
	}

	return variables
}

/**
 * A parameter's variable value. A number, as displayed (by the parameter's formula, or else its factor) or, with
 * `displayed` off, as the device has it; a formula that can't be computed leaves it as the device has it. A string with
 * its control characters written out, an octet string as its bytes, anything else as it is; null for none.
 */
export function parameterVariableValue(parameter: EmberModel.Parameter, displayed: boolean): CompanionVariableValue {
	const { value } = parameter
	if (value === undefined || value === null) return null
	if (typeof value === 'number') {
		if (!displayed) return value
		try {
			return displayedNumber(parameter) ?? value
		} catch {
			return value
		}
	}
	if (typeof value === 'string') return substituteEscapeCharacters(value)
	return Buffer.isBuffer(value) ? Array.from(value) : value
}
