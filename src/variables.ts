import type {
	CompanionVariableDefinitions,
	CompanionVariableValue,
	CompanionVariableValues,
} from '@companion-module/base'
import {
	connectionValue,
	connectLimits,
	isNToN,
	matrixName,
	matrixTypeName,
	signalLabel,
	signalNumbers,
	targetDisposition,
	type MatrixInfo,
	type SignalKind,
} from './matrices.js'
import { elementLabel } from './identifiers.js'
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
		// As the dropdowns list it: by its path, and its path by identifiers
		const name = elementLabel(path, parameter, state.parameterElements.get(path))
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
	/** Matrix - Target Disposition: each target's connection disposition */
	dispositions: boolean
}

/** A matrix variable's id: a signal's name, or a target's connected sources or connection disposition */
export function matrixVariableId(
	path: string,
	kind: SignalKind,
	signal: number,
	what: 'name' | 'sources' | 'disposition',
): string {
	return `matrix_${sanitiseVariableId(path)}_${kind}_${signal}_${what}`
}

/**
 * A matrix's own variables, whatever the Connection Variables: its name, its targets' numbers, its sources' and its
 * type; and an N:N matrix's connection limits
 */
const MATRIX_VARIABLES = {
	name: 'Name',
	targets: 'Targets',
	sources: 'Sources',
	type: 'Type',
} as const satisfies Record<string, string>
const N_TO_N_VARIABLES = {
	max_connects_per_target: 'Maximum Connects per Target',
	max_total_connects: 'Maximum Total Connects',
} as const satisfies Record<string, string>
type MatrixVariable = keyof typeof MATRIX_VARIABLES | keyof typeof N_TO_N_VARIABLES

/** A matrix's own variable's id */
export function matrixOwnVariableId(path: string, what: MatrixVariable): string {
	return `matrix_${sanitiseVariableId(path)}_${what}`
}

/**
 * The variables of the loaded matrices: each one's own (its targets' and sources' numbers, and its type), whatever the
 * Connection Variables; and for the kinds chosen, each target's and source's name, and each target's connected sources.
 * A matrix gets them once it is loaded from the provider, which gives its targets and sources.
 */
export function GetMatrixVariablesList(state: EmberPlusState, kinds: MatrixVariables): CompanionVariableDefinitions {
	const variables: CompanionVariableDefinitions = {}
	for (const info of state.matrices.values()) {
		const matrix = info.node?.contents
		if (!matrix) continue
		const own = { ...MATRIX_VARIABLES, ...(isNToN(matrix) ? N_TO_N_VARIABLES : {}) }
		for (const [what, name] of Object.entries(own) as [MatrixVariable, string][]) {
			variables[matrixOwnVariableId(info.path, what)] = { name: `Matrix ${info.path}: ${name}` }
		}
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
			if (kinds.dispositions) {
				variables[matrixVariableId(info.path, 'target', target, 'disposition')] = {
					name: `Matrix ${info.path}: Target ${target} Disposition`,
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
 * A loaded matrix's variable values: its own, its name (matrixName), its targets' and sources' numbers, lowest first,
 * its type (matrixTypeName), and an N:N matrix's connection limits (connectLimits); and for the kinds chosen, a signal's
 * name (its first label, or else its identifier, as reported; empty for neither), and a target's connected sources
 * (connectionValue: an N:N matrix's numbers, any other's one number or null; null until the connections are loaded),
 * and its connection disposition (targetDisposition: tally, modified, pending or locked; null until loaded, or for a
 * target with no connection reported)
 */
export function matrixVariableValues(info: MatrixInfo, kinds: MatrixVariables): CompanionVariableValues {
	const values: CompanionVariableValues = {}
	const matrix = info.node?.contents
	if (!matrix) return values
	values[matrixOwnVariableId(info.path, 'name')] = matrixName(info)
	values[matrixOwnVariableId(info.path, 'targets')] = signalNumbers(matrix, 'target')
	values[matrixOwnVariableId(info.path, 'sources')] = signalNumbers(matrix, 'source')
	values[matrixOwnVariableId(info.path, 'type')] = matrixTypeName(matrix)
	if (isNToN(matrix)) {
		const limits = connectLimits(matrix)
		values[matrixOwnVariableId(info.path, 'max_connects_per_target')] = limits.perTarget
		values[matrixOwnVariableId(info.path, 'max_total_connects')] = limits.total
	}
	for (const target of signalNumbers(matrix, 'target')) {
		if (kinds.targetNames) {
			values[matrixVariableId(info.path, 'target', target, 'name')] = signalLabel(info, 'target', target) ?? ''
		}
		if (kinds.connections) {
			values[matrixVariableId(info.path, 'target', target, 'sources')] = connectionValue(info, target)
		}
		if (kinds.dispositions) {
			values[matrixVariableId(info.path, 'target', target, 'disposition')] = targetDisposition(info, target)
		}
	}
	if (kinds.sourceNames) {
		for (const source of signalNumbers(matrix, 'source')) {
			values[matrixVariableId(info.path, 'source', source, 'name')] = signalLabel(info, 'source', source) ?? ''
		}
	}
	return values
}
