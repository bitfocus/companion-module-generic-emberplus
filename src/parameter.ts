import type {
	CompanionActionEvent,
	CompanionActionInfo,
	CompanionActionContext,
	CompanionFeedbackContext,
	CompanionFeedbackInfo,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, type setValueActionOptions } from './actions'
import type { parameterFeedbackOptions } from './feedback'
import type { EmberPlusInstance } from './index'
import { EmberPlusState } from './state'
import {
	calcRelativeNumber,
	checkNumberLimits,
	compareNumber,
	NumberComparitor,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from './util'
import { FeedbackId } from './feedback'
import { ParameterType } from 'emberplus-connection/dist/model'

export const subscribeParameterAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionInfo, context: CompanionActionContext): Promise<void> => {
		if (action.options.variable || action.options.toggle || action.options.relative) {
			await self.registerNewParameter(await resolveEventPath(action, context))
		}
	}

export const learnSetValueActionOptions =
	(state: EmberPlusState, paramType: EmberModel.ParameterType, actionType: ActionId) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<setValueActionOptions | undefined> => {
		const path = await resolveEventPath(action, context)
		if (!state.parameters.has(path)) return undefined
		const emberPath = state.parameters.get(path)
		if (paramType !== emberPath?.parameterType) return undefined
		const options = action.options as setValueActionOptions
		switch (actionType) {
			case ActionId.SetValueString:
				if (emberPath?.value !== null && emberPath?.value !== undefined) {
					options.value = action.options.parseEscapeChars
						? substituteEscapeCharacters(emberPath.value.toString())
						: emberPath.value.toString()
				}
				break
			case ActionId.SetValueBoolean:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Boolean(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				break
			case ActionId.SetValueEnum:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) {
					options.min = emberPath.minimum.toString()
				} else {
					options.min = '0'
				}

				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				break
			case ActionId.SetValueInt:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) options.min = emberPath.minimum.toString()
				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				if (emberPath?.factor !== null && emberPath?.factor !== undefined) {
					options.factor = emberPath.factor.toString()
					options.value = Number(options.value) / emberPath.factor
					options.valueVar = options.value.toString()
				} else if (emberPath?.value !== null && emberPath?.value !== undefined) {
					options.factor = '1'
				}
				break
			case ActionId.SetValueReal:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) options.min = emberPath.minimum.toString()
				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				break
			case ActionId.SetValueEnumLookup:
				if (emberPath?.value !== null && emberPath?.value !== undefined && emberPath.enumeration !== undefined) {
					options.value = state.getCurrentEnumValue(path)
				} else return undefined
				break
			default:
				return undefined
		}
		return options
	}

export const setValue =
	(
		self: EmberPlusInstance,
		emberClient: EmberClient,
		paramType: EmberModel.ParameterType,
		actionType: ActionId,
		state: EmberPlusState,
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const path = await resolveEventPath(action, context)
		const node = await self.registerNewParameter(
			path,
			Boolean(action.options.variable || action.options.toggle || action.options.relative),
		)
		if (node === undefined || node.contents.type !== EmberModel.ElementType.Parameter) {
			self.log('warn', 'Parameter ' + action.options['path'] + ' not found or not a parameter')
			return
		}
		if (
			node.contents?.access === EmberModel.ParameterAccess.None ||
			node.contents?.access === EmberModel.ParameterAccess.Read
		) {
			self.log('warn', `Can't write to ${path} insufficent permissions: ${node.contents.access}`)
			return
		}
		await queue
			.add(async () => {
				// TODO - do we handle not found?
				if (node.contents.type === EmberModel.ElementType.Parameter) {
					if (node.contents.parameterType === paramType) {
						self.log('debug', 'Got node on ' + path)
						let value: string | number | boolean
						let factor: number
						switch (actionType) {
							case ActionId.SetValueString:
								value = await context.parseVariablesInString(action.options['value']?.toString() ?? '')
								if (action.options['parseEscapeChars']) value = parseEscapeCharacters(value)
								break
							case ActionId.SetValueInt:
								factor = parseInt(await context.parseVariablesInString(action.options['factor']?.toString() ?? '1'))
								if (isNaN(factor)) factor = 1
								value = action.options['useVar']
									? Math.floor(
											Number(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? '')) *
												factor,
										)
									: Math.floor(Number(action.options['value']) * factor)
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										paramType,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? -4294967295,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case ActionId.SetValueReal:
								value = action.options['useVar']
									? Number(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Number(action.options['value'])
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										paramType,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? -4294967295,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case ActionId.SetValueEnum:
								value = action.options['useVar']
									? parseInt(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Math.floor(Number(action.options['value']))
								if (isNaN(value) || value > 4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										paramType,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? 0,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case ActionId.SetValueEnumLookup:
								value = await context.parseVariablesInString(action.options['value']?.toString() ?? '')
								value = state.getEnumIndex(path, value) ?? -1
								if (value < 0) {
									self.log('warn', `Index of ${value} not found in enum map of ${path}`)
									return
								}
								break
							case ActionId.SetValueBoolean:
								if (action.options['toggle']) {
									value = !state.parameters.get(path)?.value
								} else if (action.options['useVar']) {
									switch (await context.parseVariablesInString(action.options['valueVar']?.toString() ?? '')) {
										case 'true':
										case 'on':
										case '1':
											value = true
											break
										case 'false':
										case 'off':
										case '0':
											value = false
											break
										default:
											value = Boolean(
												await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''),
											)
									}
								} else {
									value = Boolean(action.options['value'])
								}
								break
							default:
								return
						}
						const request = await emberClient.setValue(
							node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
							value,
							false,
						)
						request.response?.catch(() => null) // Ensure the response is 'handled'
					} else {
						self.log(
							'warn',
							'Node ' +
								action.options['path'] +
								' is not of type ' +
								paramType +
								' (is ' +
								node.contents.parameterType +
								')',
						)
					}
				}
			})
			.catch((e: any) => {
				self.log('debug', `Failed to set value: ${e.toString()}`)
			})
	}

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
		state.updatePathOnIdMap(feedback.id, '')
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
