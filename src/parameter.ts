import type { CompanionActionEvent, CompanionActionInfo, CompanionActionContext } from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, type setValueActionOptions } from './actions'
import type { EmberPlusInstance } from './index'
import { EmberPlusState } from './state'
import {
	calcRelativeNumber,
	checkNumberLimits,
	getCurrentEnumValue,
	getEnumIndex,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from './util'

export const registerParameter =
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
					options.value = substituteEscapeCharacters(emberPath.value.toString())
					options.parseEscapeChars = true
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
					options.value = getCurrentEnumValue(state, path)
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
		if (action.options.variable || action.options.toggle || action.options.relative) {
			await self.registerNewParameter(path)
		}
		await queue
			.add(async () => {
				const node = await emberClient.getElementByPath(path)
				// TODO - do we handle not found?
				if (node && node.contents.type === EmberModel.ElementType.Parameter) {
					if (node.contents.parameterType === paramType) {
						if (
							node.contents?.access === EmberModel.ParameterAccess.None ||
							node.contents?.access === EmberModel.ParameterAccess.Read
						) {
							self.log('warn', `Can't write to ${path} insufficent permissions: ${node.contents.access}`)
							return
						}
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
								value = getEnumIndex(state, path, value) ?? -1
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
				} else {
					self.log('warn', 'Parameter ' + action.options['path'] + ' not found or not a parameter')
				}
			})
			.catch((e: any) => {
				self.log('debug', `Failed to set value: ${e.toString()}`)
			})
	}
