import type { CompanionFeedbackContext, CompanionFeedbackInfo, JsonValue } from '@companion-module/base'
import { Model as EmberModel } from 'emberplus-connection'
import type { parameterFeedbackOptions } from '../feedback'
import type { EmberPlusInstance } from '../index'
import { EmberPlusState } from '../state'
import {
	compareNumber,
	NumberComparitor,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from '../util'
import { FeedbackId } from '../feedback'
import { ParameterType } from 'emberplus-connection/dist/model'

export const subscribeParameterFeedback =
	(state: EmberPlusState, self: EmberPlusInstance) =>
	async (feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): Promise<void> => {
		const path = resolveEventPath(feedback)
		if (await self.registerNewParameter(path, true)) state.addIdToPathMap(feedback.id, path)
	}

export const unsubscribeParameterFeedback =
	(state: EmberPlusState) =>
	async (feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): Promise<void> => {
		state.addIdToPathMap(feedback.id, '')
	}

export const learnParameterFeedbackOptions =
	(state: EmberPlusState, feedbackType: FeedbackId) =>
	async (
		feedback: CompanionFeedbackInfo,
		_context: CompanionFeedbackContext,
	): Promise<parameterFeedbackOptions | undefined> => {
		const path = resolveEventPath(feedback)
		const val = state.parameters.get(path)
		if (val === undefined || val === null || val.value === undefined || val.value === null) return undefined
		const options = feedback.options as parameterFeedbackOptions
		const enumVal = state.getCurrentEnumValue(path)
		switch (feedbackType) {
			case FeedbackId.String:
				options.value = feedback.options.parseEscapeChars
					? substituteEscapeCharacters(val.value.toString())
					: val.value.toString()
				break
			case FeedbackId.ENUM:
				if (enumVal === '') return undefined
				options.value = enumVal
				break
			case FeedbackId.Parameter:
				if (typeof val?.value !== 'number') return undefined
				options.value = val.value
				options.valueVar = val.value.toString()
				options.factor = val.factor?.toString() ?? options.factor
				options.asInt = val.parameterType == ParameterType.Integer || val.parameterType == ParameterType.Enum
				break
			default:
				return undefined
		}
		return options
	}

interface resolveFeedbackOptions {
	comparitor?: NumberComparitor
	factor?: string
	parse?: boolean
}

export async function resolveBooleanFeedback(
	state: EmberPlusState,
	type: EmberModel.ParameterType,
	path: string,
	value?: boolean | number | string,
	options: resolveFeedbackOptions = { comparitor: NumberComparitor.Equal, factor: `1`, parse: true },
): Promise<boolean> {
	let fact = Number.parseInt(options.factor ?? '1')
	options.comparitor = options.comparitor ?? NumberComparitor.Equal
	if (Number.isNaN(fact) || fact < 1) fact = 1

	switch (type) {
		case EmberModel.ParameterType.Boolean:
			return Boolean(state.parameters.get(path)?.value)
		case EmberModel.ParameterType.Real:
			return compareNumber(Number(value), options.comparitor, Number(state.parameters.get(path)?.value))
		case EmberModel.ParameterType.Integer:
			return compareNumber(
				Math.floor(Number(value) * fact),
				options.comparitor,
				Math.floor(Number(state.parameters.get(path)?.value)),
			)
		case EmberModel.ParameterType.Enum:
			return state.getCurrentEnumValue(path) == value
		case EmberModel.ParameterType.String:
		default:
			if (options.parse) value = parseEscapeCharacters(value?.toString() ?? '')
			return state.parameters.get(path)?.value?.toString() == value
	}
}

export const parameterFeedbackCallback =
	(self: EmberPlusInstance, state: EmberPlusState, feedbackType: FeedbackId) =>
	async (feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): Promise<boolean> => {
		const path = resolveEventPath(feedback)
		if (await self.registerNewParameter(path, true)) state.addIdToPathMap(feedback.id, path)
		if (state.parameters.has(path)) {
			switch (feedbackType) {
				case FeedbackId.Boolean:
					return await resolveBooleanFeedback(state, EmberModel.ParameterType.Boolean, path)
				case FeedbackId.ENUM:
					return await resolveBooleanFeedback(
						state,
						EmberModel.ParameterType.Enum,
						path,
						feedback.options['value']?.toString() ?? '',
					)
				case FeedbackId.Parameter:
					return await resolveBooleanFeedback(
						state,
						feedback.options['asInt'] ? EmberModel.ParameterType.Integer : EmberModel.ParameterType.Real,
						path,
						feedback.options['useVar'] ? String(feedback.options['valueVar']) : Number(feedback.options['value']),
						{
							comparitor: feedback.options['comparitor'] as NumberComparitor,
							factor: feedback.options['factor']?.toString() ?? '1',
						},
					)
				case FeedbackId.String:
					return await resolveBooleanFeedback(
						state,
						EmberModel.ParameterType.String,
						path,
						feedback.options['value']?.toString() ?? '',
						{ parse: Boolean(feedback.options['parseEscapeChars']) },
					)
			}
		} else {
			self.registerNewParameter(path, true).catch(() => {})
		}
		return false
	}

export const parameterValueFeedbackCallback =
	(self: EmberPlusInstance, state: EmberPlusState) =>
	async (feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): Promise<JsonValue> => {
		const path = resolveEventPath(feedback)
		if (await self.registerNewParameter(path, false)) state.addIdToPathMap(feedback.id, path)
		if (state.parameters.has(path)) {
			const value = state.parameters.get(path)?.value ?? null
			if (state.parameters.get(path)?.parameterType == EmberModel.ParameterType.Integer && typeof value == 'number') {
				const factor = state.parameters.get(path)?.factor ?? 1
				return value / factor
			}
			if (Buffer.isBuffer(value)) {
				return Array.from(value)
			}
			return value
		} else {
			self.registerNewParameter(path, false).catch(() => {})
		}
		return null
	}
