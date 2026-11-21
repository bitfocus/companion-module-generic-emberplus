import type {
	CompanionFeedbackCallbackContext,
	CompanionFeedbackContext,
	CompanionFeedbackInfo,
	CompanionFeedbackLearnContext,
} from '@companion-module/base'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import type { ParameterFeedbackOptions } from '../feedback.js'
import type EmberPlusInstance from '../index.js'
import { EmberPlusState } from '../state.js'
import { parameterProperty, type ParameterPropertyValue } from './property.js'
import {
	compareNumber,
	NumberComparitor,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from '../util.js'
import { FeedbackId } from '../feedback.js'

/** The feedback is removed or disabled: stop rechecking it, and end its stream if nothing else reads it */
export const unsubscribeParameterFeedback =
	(self: EmberPlusInstance) =>
	async (
		feedback: CompanionFeedbackInfo<ParameterFeedbackOptions>,
		_context: CompanionFeedbackContext,
	): Promise<void> => {
		self.releaseParameterFeedback(feedback.id)
	}

/**
 * Learn the parameter's current value, and for numbers its factor. Returns only what was learned, so an expression in
 * the path is kept.
 */
export const learnParameterFeedbackOptions =
	<TOptions extends ParameterFeedbackOptions>(state: EmberPlusState, feedbackType: FeedbackId) =>
	async (
		feedback: CompanionFeedbackInfo<TOptions>,
		_context: CompanionFeedbackLearnContext,
	): Promise<Partial<TOptions> | undefined> => {
		const path = resolveEventPath(feedback)
		const val = state.parameters.get(path)
		if (val === undefined || val === null || val.value === undefined || val.value === null) return undefined
		const learned: ParameterFeedbackOptions = {}
		const enumVal = state.getCurrentEnumValue(path)
		switch (feedbackType) {
			case FeedbackId.String:
				learned.value = feedback.options.parseEscapeChars
					? substituteEscapeCharacters(val.value.toString())
					: val.value.toString()
				break
			case FeedbackId.ENUM:
				if (enumVal === '') return undefined
				learned.value = enumVal
				break
			case FeedbackId.Parameter:
				if (typeof val?.value !== 'number') return undefined
				// The device's value, with a factor of 1: the feedback multiplies the value by its factor before comparing it
				// with the device's, so learning the parameter's factor too applied it twice, and the feedback never matched
				learned.value = val.value
				learned.factor = 1
				learned.asInt =
					val.parameterType === EmberModel.ParameterType.Integer || val.parameterType === EmberModel.ParameterType.Enum
				break
			default:
				return undefined
		}
		// Each case sets only the keys its feedback's options have, with the types they have there
		return learned as Partial<TOptions>
	}

interface resolveFeedbackOptions {
	comparitor?: NumberComparitor
	factor?: number
	parse?: boolean
}

export async function resolveBooleanFeedback(
	state: EmberPlusState,
	type: EmberModel.ParameterType,
	path: string,
	value?: boolean | number | string,
	options: resolveFeedbackOptions = { comparitor: NumberComparitor.Equal, factor: 1, parse: true },
): Promise<boolean> {
	let fact = Math.trunc(Number(options.factor ?? 1))
	options.comparitor = options.comparitor ?? NumberComparitor.Equal
	if (Number.isNaN(fact) || fact < 1) fact = 1

	const current = state.parameters.get(path)?.value
	// A number parameter without a value (null: none at present, Glow 2.50) compares as nothing, not as 0
	const hasNumber = current !== null && current !== undefined
	switch (type) {
		case EmberModel.ParameterType.Boolean:
			return Boolean(current)
		case EmberModel.ParameterType.Real:
			return hasNumber && compareNumber(Number(value), options.comparitor, Number(current))
		case EmberModel.ParameterType.Integer:
			// Only Factorize integer parameters
			return (
				hasNumber && compareNumber(Math.floor(Number(value) * fact), options.comparitor, Math.floor(Number(current)))
			)
		case EmberModel.ParameterType.Enum: {
			// By the entry named: a name beginning with "~" matches with it or without it, as it may have been typed
			const entry = state.getEnumValue(path, value?.toString() ?? '')
			return entry !== undefined && entry === current
		}
		case EmberModel.ParameterType.String:
		default:
			if (options.parse) value = parseEscapeCharacters(value?.toString() ?? '')
			return current?.toString() === value
	}
}

export const parameterFeedbackCallback =
	<TOptions extends ParameterFeedbackOptions>(
		self: EmberPlusInstance,
		state: EmberPlusState,
		feedbackType: FeedbackId,
	) =>
	async (feedback: CompanionFeedbackInfo<TOptions>, context: CompanionFeedbackCallbackContext): Promise<boolean> => {
		const path = resolveEventPath(feedback)
		await self.useParameterForFeedback(feedback.id, path, context.signal)
		if (state.parameters.has(path)) {
			switch (feedbackType) {
				case FeedbackId.Boolean:
					return await resolveBooleanFeedback(state, EmberModel.ParameterType.Boolean, path)
				case FeedbackId.ENUM:
					return await resolveBooleanFeedback(
						state,
						EmberModel.ParameterType.Enum,
						path,
						feedback.options.value?.toString() ?? '',
					)
				case FeedbackId.Parameter:
					return await resolveBooleanFeedback(
						state,
						feedback.options.asInt ? EmberModel.ParameterType.Integer : EmberModel.ParameterType.Real,
						path,
						Number(feedback.options.value),
						{
							comparitor: feedback.options.comparitor,
							factor: feedback.options.factor ?? 1,
						},
					)
				case FeedbackId.String:
					return await resolveBooleanFeedback(
						state,
						EmberModel.ParameterType.String,
						path,
						feedback.options.value?.toString() ?? '',
						{ parse: Boolean(feedback.options.parseEscapeChars) },
					)
			}
		}
		return false
	}

export const parameterPropertyFeedbackCallback =
	<TOptions extends ParameterFeedbackOptions>(self: EmberPlusInstance, state: EmberPlusState) =>
	async (
		feedback: CompanionFeedbackInfo<TOptions>,
		context: CompanionFeedbackCallbackContext,
	): Promise<ParameterPropertyValue> => {
		const path = resolveEventPath(feedback)
		await self.useParameterForFeedback(feedback.id, path, context.signal)
		const parameter = state.parameters.get(path)
		return parameter ? parameterProperty(parameter, feedback.options.property) : null
	}
