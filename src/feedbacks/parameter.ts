import type { CompanionFeedbackContext, CompanionFeedbackInfo } from '@companion-module/base'
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
	async (feedback: CompanionFeedbackInfo, context: CompanionFeedbackContext): Promise<void> => {
		const path = await resolveEventPath(feedback, context)
		await self.registerNewParameter(path)
		state.addIdtoPathMap(feedback.id, path)
	}

export const unsubscribeParameterFeedback =
	(state: EmberPlusState) =>
	async (feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): Promise<void> => {
		//const path = await resolveEventPath(feedback, context)
		state.addIdtoPathMap(feedback.id, '')
	}

export const learnParameterFeedbackOptions =
	(state: EmberPlusState, feedbackType: FeedbackId) =>
	async (
		feedback: CompanionFeedbackInfo,
		context: CompanionFeedbackContext,
	): Promise<parameterFeedbackOptions | undefined> => {
		const path = await resolveEventPath(feedback, context)
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

export async function resolveFeedback(
	self: EmberPlusInstance,
	context: CompanionFeedbackContext,
	state: EmberPlusState,
	feedbackId: string,
	type: EmberModel.ParameterType,
	path: string,
	value?: boolean | number | string,
	options: resolveFeedbackOptions = { comparitor: NumberComparitor.Equal, factor: `1`, parse: true },
): Promise<boolean> {
	state.addIdtoPathMap(feedbackId, path)
	let fact = parseInt(await context.parseVariablesInString(options.factor ?? '1'))
	options.comparitor = options.comparitor ?? NumberComparitor.Equal
	if (isNaN(fact) || fact < 1) fact = 1
	if (typeof value === 'string') {
		value = await context.parseVariablesInString(value)
	}
	if (state.parameters.has(path)) {
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
	} else {
		self.registerNewParameter(path).catch(() => {})
		return false
	}
}

export const parameterFeedbackCallback =
	(self: EmberPlusInstance, state: EmberPlusState, feedbackType: FeedbackId) =>
	async (feedback: CompanionFeedbackInfo, context: CompanionFeedbackContext): Promise<boolean> => {
		const path = await resolveEventPath(feedback, context)
		switch (feedbackType) {
			case FeedbackId.Boolean:
				return await resolveFeedback(self, context, state, feedback.id, EmberModel.ParameterType.Boolean, path)
			case FeedbackId.ENUM:
				return await resolveFeedback(
					self,
					context,
					state,
					feedback.id,
					EmberModel.ParameterType.Enum,
					path,
					feedback.options['value']?.toString() ?? '',
				)
			case FeedbackId.Parameter:
				return await resolveFeedback(
					self,
					context,
					state,
					feedback.id,
					feedback.options['asInt'] ? EmberModel.ParameterType.Integer : EmberModel.ParameterType.Real,
					path,
					feedback.options['useVar'] ? String(feedback.options['valueVar']) : Number(feedback.options['value']),
					{
						comparitor: feedback.options['comparitor'] as NumberComparitor,
						factor: feedback.options['factor']?.toString() ?? '1',
					},
				)
			case FeedbackId.String:
				return await resolveFeedback(
					self,
					context,
					state,
					feedback.id,
					EmberModel.ParameterType.String,
					path,
					feedback.options['value']?.toString() ?? '',
					{ parse: Boolean(feedback.options['parseEscapeChars']) },
				)
		}
		return false
	}
