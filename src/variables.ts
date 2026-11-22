import type {
	CompanionVariableDefinitions,
	CompanionVariableValue,
	CompanionVariableValues,
} from '@companion-module/base'
import { connectedSources, signalLabel, signalNumbers, type MatrixInfo, type SignalKind } from './matrices.js'
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

/** Which matrix variables there are, from the Connection Variables config option */
export interface MatrixVariables {
	/** Matrix - Target Names: each target's name */
	targetNames: boolean
	/** Matrix - Source Names: each source's name */
	sourceNames: boolean
	/** Matrix - Connections: each target's connected sources */
	connections: boolean
}

/** A matrix variable's id: a signal's name, or a target's connected sources */
export function matrixVariableId(path: string, kind: SignalKind, signal: number, what: 'name' | 'sources'): string {
	return `matrix_${sanitiseVariableId(path)}_${kind}_${signal}_${what}`
}

/**
 * The variables of the loaded matrices, for those of the kinds chosen: each target's and source's name, and each target's
 * connected sources. A matrix gets them once it is loaded from the provider, which gives its targets and sources.
 */
export function GetMatrixVariablesList(state: EmberPlusState, kinds: MatrixVariables): CompanionVariableDefinitions {
	const variables: CompanionVariableDefinitions = {}
	if (!kinds.targetNames && !kinds.sourceNames && !kinds.connections) return variables
	for (const info of state.matrices.values()) {
		const matrix = info.node?.contents
		if (!matrix) continue
		for (const target of signalNumbers(matrix, 'target')) {
			if (kinds.targetNames) {
				variables[matrixVariableId(info.path, 'target', target, 'name')] = {
					name: `Matrix ${info.path}: Target ${target} Name`,
				}
			}
			if (kinds.connections) {
				variables[matrixVariableId(info.path, 'target', target, 'sources')] = {
					name: `Matrix ${info.path}: Target ${target} Sources`,
				}
			}
		}
		if (kinds.sourceNames) {
			for (const source of signalNumbers(matrix, 'source')) {
				variables[matrixVariableId(info.path, 'source', source, 'name')] = {
					name: `Matrix ${info.path}: Source ${source} Name`,
				}
			}
		}
	}
	return variables
}

/**
 * A loaded matrix's variable values, for the kinds chosen: a signal's name (its first label, or else its identifier, as
 * reported; empty for neither), and a target's connected sources, their numbers lowest first (empty for none, and null
 * until the provider gives the connections)
 */
export function matrixVariableValues(info: MatrixInfo, kinds: MatrixVariables): CompanionVariableValues {
	const values: CompanionVariableValues = {}
	const matrix = info.node?.contents
	if (!matrix) return values
	for (const target of signalNumbers(matrix, 'target')) {
		if (kinds.targetNames) {
			values[matrixVariableId(info.path, 'target', target, 'name')] = signalLabel(info, 'target', target) ?? ''
		}
		if (kinds.connections) {
			values[matrixVariableId(info.path, 'target', target, 'sources')] = connectedSources(info, target) ?? null
		}
	}
	if (kinds.sourceNames) {
		for (const source of signalNumbers(matrix, 'source')) {
			values[matrixVariableId(info.path, 'source', source, 'name')] = signalLabel(info, 'source', source) ?? ''
		}
	}
	return values
}
