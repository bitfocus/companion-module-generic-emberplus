import type { CompanionInputFieldDropdown, CompanionInputFieldMultiDropdown } from '@companion-module/base'
import { isNToN, matrixLabel, signalChoices, type MatrixInfo, type SignalKind } from './matrices.js'
import { isSignalNumber } from './ranges.js'
import type { EmberPlusState } from './state.js'

/**
 * Each configured matrix's target and source fields, by its key (matrixOptionKeys): its target; the source of an action
 * or feedback that takes one (`source_<key>`); and the sources of a connection action (`sources_<key>`), a multi-select
 * for an N:N matrix and a dropdown of one for any other, under the one id, so a choice survives the matrix loading. Only
 * the chosen matrix's fields show. The values are as Companion gives them: a field in expression mode may hand over
 * any value, and a dropdown's one source is a number where a multi-select's are a list, which the callbacks check.
 */
export type MatrixSignalOptions = {
	[key: `target_${string}`]: number
	[key: `source_${string}`]: number
	[key: `sources_${string}`]: number[] | number
}

/** A matrix action's or feedback's options: the matrix, by its configured path, and its signals */
export type MatrixOptions = { matrix: string } & MatrixSignalOptions

/** Set Connection's source for no source: it disconnects the target's sources */
export const NoSource = -1

/** A string as a single quoted literal in a Companion expression */
function quoted(text: string): string {
	return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

/** The visibility of a matrix's own fields: shown while it is the chosen matrix, and, if given, while `also` holds */
function forMatrix(info: MatrixInfo, also?: string): string {
	const chosen = `$(options:matrix) == ${quoted(info.path)}`
	return also ? `${chosen} && ${also}` : chosen
}

/**
 * The matrix dropdown: the matrices in the module config, by path. Not an expression, as the target and source fields
 * show by it, and Companion only reads a field that can't be an expression for that.
 */
export function matrixDropdown(state: EmberPlusState): CompanionInputFieldDropdown<'matrix', string> {
	const choices = [...state.matrices.values()].map((info) => ({ id: info.path, label: matrixLabel(info) }))
	return {
		type: 'dropdown',
		label: 'Matrix',
		id: 'matrix',
		choices,
		default: choices[0]?.id ?? '',
		disableAutoExpression: true,
		tooltip: 'The matrices given in the module config',
	}
}

const signalTooltip =
	'Listed once the matrix is loaded from the provider, with their labels. In expression mode, give the number'

/** A dropdown of a matrix's targets or sources, the first as default */
function signalDropdown<TKey extends string>(
	info: MatrixInfo,
	kind: SignalKind,
	id: TKey,
	visibility: string,
	none: boolean,
): CompanionInputFieldDropdown<TKey, number> {
	const choices = signalChoices(info, kind)
	if (none) choices.unshift({ id: NoSource, label: 'None' })
	return {
		type: 'dropdown',
		label: kind === 'target' ? 'Target' : 'Source',
		id,
		choices,
		default: choices[0]?.id ?? 0,
		isVisibleExpression: visibility,
		// A number not listed (the matrix isn't loaded yet, or its expression gives another) goes to the callback, which
		// checks it, rather than skipping the action
		allowInvalidValues: true,
		tooltip: signalTooltip,
	}
}

/** Each configured matrix's target dropdown, shown while it is the chosen matrix and, if given, `also` holds */
export function targetFields(
	state: EmberPlusState,
	also?: string,
): CompanionInputFieldDropdown<`target_${string}`, number>[] {
	return [...state.matrices.values()].map((info) =>
		signalDropdown(info, 'target', `target_${info.key}`, forMatrix(info, also), false),
	)
}

export interface SourceFieldOptions {
	/** Whether an N:N matrix takes several sources, in a multi-select. Otherwise each matrix takes one */
	several: boolean
	/** Whether the dropdown of one source offers None, for no source */
	none?: boolean
	/** Shown only while this holds too */
	also?: string
}

/**
 * Each configured matrix's source field, shown while it is the chosen matrix. With `several` (the connection actions),
 * `sources_<key>`: a multi-select of an N:N matrix's sources, or a dropdown of one for any other, a matrix not yet
 * loaded counting as 1:N, the specification's default. The id stays the same as the field changes, so a source chosen
 * before the matrix loads isn't lost when it turns out to be N:N. Without `several`, `source_<key>`, a dropdown of one.
 */
export function sourceFields(
	state: EmberPlusState,
	{ several, none = false, also }: SourceFieldOptions,
): (
	| CompanionInputFieldDropdown<`source_${string}` | `sources_${string}`, number>
	| CompanionInputFieldMultiDropdown<`sources_${string}`, number>
)[] {
	return [...state.matrices.values()].map((info) => {
		const visibility = forMatrix(info, also)
		if (!several) return signalDropdown(info, 'source', `source_${info.key}`, visibility, none)
		if (isNToN(info.node?.contents)) {
			return {
				type: 'multidropdown',
				label: 'Sources',
				id: `sources_${info.key}`,
				choices: signalChoices(info, 'source'),
				default: [],
				isVisibleExpression: visibility,
				allowInvalidValues: true,
				tooltip: signalTooltip,
			}
		}
		return signalDropdown(info, 'source', `sources_${info.key}`, visibility, none)
	})
}

/** The configured matrix an action or feedback names; throws for one not in the module config */
export function chosenMatrix(state: EmberPlusState, matrix: unknown): MatrixInfo {
	const info = typeof matrix === 'string' ? state.matrices.get(matrix) : undefined
	if (!info) {
		const named = typeof matrix === 'string' ? matrix : (JSON.stringify(matrix) ?? '')
		throw new Error(`Matrix ${named} is not one of the matrices in the module config`)
	}
	return info
}

/** A signal number from an option's value, which an expression may have given as text; NaN for none */
function signalOf(value: unknown): number {
	if (typeof value === 'number') return value
	if (typeof value === 'string' && value.trim() !== '') return Number(value)
	return NaN
}

/** The target an action or feedback gives for a matrix; throws for none, or a number Ember+ doesn't allow */
export function targetOf(options: MatrixSignalOptions, info: MatrixInfo): number {
	const target = signalOf(options[`target_${info.key}`])
	if (!isSignalNumber(target)) {
		throw new Error(`Matrix ${info.path}: invalid target: ${String(options[`target_${info.key}`])}`)
	}
	return target
}

/**
 * The sources a connection action gives for a matrix (`sources_<key>`): a list from a multi-select (an N:N matrix), or
 * one from a dropdown, None being no source. An expression's text may list several, comma separated. Throws for one
 * that Ember+ doesn't allow.
 */
export function sourcesOf(options: MatrixSignalOptions, info: MatrixInfo): number[] {
	const value: unknown = options[`sources_${info.key}`]
	const values = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.split(',').filter((part) => part.trim() !== '')
			: value === undefined || value === null
				? []
				: [value]
	const sources: number[] = []
	for (const part of values) {
		const source = signalOf(part)
		if (source === NoSource) continue
		if (!isSignalNumber(source)) throw new Error(`Matrix ${info.path}: invalid source: ${String(part).trim()}`)
		sources.push(source)
	}
	return sources
}

/** The one source an action or feedback gives for a matrix, from its dropdown of one; throws for none or an invalid one */
export function sourceOf(options: MatrixSignalOptions, info: MatrixInfo): number {
	const source = signalOf(options[`source_${info.key}`])
	if (!isSignalNumber(source)) {
		throw new Error(`Matrix ${info.path}: invalid source: ${String(options[`source_${info.key}`])}`)
	}
	return source
}
