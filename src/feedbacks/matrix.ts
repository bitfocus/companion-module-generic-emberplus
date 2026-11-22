import type { CompanionFeedbackInfo, DropdownChoice } from '@companion-module/base'
import type { MatrixPropertyOptions, SourceSelectedOptions, TargetSelectedOptions } from '../feedback.js'
import { signalProperty, type MatrixPropertyValue, type SignalKind } from '../matrices.js'
import { sourceOf, targetOf } from '../matrixOptions.js'
import type { EmberPlusState } from '../state.js'

export const signalKindChoices = [
	{ id: 'target', label: 'Target' },
	{ id: 'source', label: 'Source' },
] as const satisfies DropdownChoice<SignalKind>[]

/**
 * Matrix Property: a property of the chosen matrix's target or source. The feedback is rechecked when the matrix
 * changes, so it registers against the matrix first, before anything can make it return early: a feedback edited onto
 * another matrix leaves the one it read. Null for a matrix not configured or not loaded, or a signal it doesn't have.
 */
export const matrixPropertyFeedbackCallback =
	(state: EmberPlusState) =>
	(feedback: CompanionFeedbackInfo<MatrixPropertyOptions>): MatrixPropertyValue => {
		const { options } = feedback
		state.addMatrixFeedback(feedback.id, String(options.matrix ?? ''))
		const info = state.matrices.get(options.matrix)
		if (!info) return null
		try {
			return options.signal === 'source'
				? signalProperty(info, 'source', sourceOf(options, info), options.sourceProperty)
				: signalProperty(info, 'target', targetOf(options, info), options.targetProperty)
		} catch {
			// No target or source given, or one Ember+ doesn't allow
			return null
		}
	}

export const unsubscribeMatrixFeedback =
	(state: EmberPlusState) =>
	({ id }: { id: string }): void =>
		state.removeMatrixFeedback(id)

/** Whether a source is the one selected, on the selected matrix */
export const sourceSelectedFeedbackCallback =
	(state: EmberPlusState) =>
	(feedback: CompanionFeedbackInfo<SourceSelectedOptions>): boolean => {
		const info = state.matrices.get(feedback.options.matrix)
		if (!info || info.path !== state.selected.matrix) return false
		try {
			return sourceOf(feedback.options, info) === state.selected.source
		} catch {
			return false
		}
	}

/** Whether a target is the one selected, on the selected matrix */
export const targetSelectedFeedbackCallback =
	(state: EmberPlusState) =>
	(feedback: CompanionFeedbackInfo<TargetSelectedOptions>): boolean => {
		const info = state.matrices.get(feedback.options.matrix)
		if (!info || info.path !== state.selected.matrix) return false
		try {
			return targetOf(feedback.options, info) === state.selected.target
		} catch {
			return false
		}
	}
