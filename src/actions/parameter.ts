import type {
	CompanionActionEvent,
	CompanionActionInfo,
	CompanionActionContext,
	CompanionOptionValues,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, type setValueActionOptions } from '../actions'
import type { EmberPlusInstance } from '../index'
import { EmberPlusState } from '../state'
import {
	calcRelativeNumber,
	checkNumberLimits,
	isDefined,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from '../util'

export const subscribeParameterAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionInfo, _context: CompanionActionContext): Promise<void> => {
		if (action.options.variable || action.options.toggle || action.options.relative || action.options.asEnum) {
			await self.registerNewParameter(resolveEventPath(action))
		}
	}

const setNumericOptions = (options: setValueActionOptions, emberPath: any) => {
	if (isDefined(emberPath.value)) {
		options.value = Number(emberPath.value)
		options.valueVar = emberPath.value.toString()
	}
	if (isDefined(emberPath.minimum)) options.min = emberPath.minimum.toString()
	if (isDefined(emberPath.maximum)) options.max = emberPath.maximum.toString()
}

export const learnSetValueActionOptions =
	(state: EmberPlusState, paramType: EmberModel.ParameterType, actionType: ActionId) =>
	async (
		action: CompanionActionEvent,
		_context: CompanionActionContext,
	): Promise<setValueActionOptions | undefined> => {
		const path = resolveEventPath(action)
		const emberPath = state.parameters.get(path)

		if (!emberPath || paramType !== emberPath.parameterType) return undefined

		const options = action.options as setValueActionOptions
		const { value } = emberPath

		switch (actionType) {
			case ActionId.SetValueString:
				if (isDefined(value)) {
					options.value = action.options.parseEscapeChars
						? substituteEscapeCharacters(value.toString())
						: value.toString()
				}
				break

			case ActionId.SetValueBoolean:
				if (isDefined(value)) {
					options.value = Boolean(value)
					options.valueVar = value.toString()
				}
				break

			case ActionId.SetValueEnum:
				setNumericOptions(options, emberPath)
				if (!isDefined(emberPath.minimum)) options.min = '0'
				if (isDefined(value) && emberPath.enumeration !== undefined) {
					options.enumValue = state.getCurrentEnumValue(path)
				}
				break

			case ActionId.SetValueInt:
				setNumericOptions(options, emberPath)
				if (isDefined(emberPath.factor)) {
					options.factor = emberPath.factor.toString()
					options.value = Number(options.value) / emberPath.factor
					options.valueVar = options.value.toString()
				} else if (isDefined(value)) {
					options.factor = '1'
				}
				break

			case ActionId.SetValueReal:
				setNumericOptions(options, emberPath)
				break

			default:
				return undefined
		}

		return options
	}

const parseStringValue = (options: CompanionOptionValues): string => {
	let value = options.value?.toString() ?? ''
	if (options.parseEscapeChars) value = parseEscapeCharacters(value)
	return value
}

const parseNumericValue = (
	options: CompanionOptionValues,
	path: string,
	paramType: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real,
	state: EmberPlusState,
	isInteger: boolean = false,
): number | undefined => {
	const factor = isInteger ? Number.parseInt(options.factor?.toString() ?? '1') : 1
	const effectiveFactor = isNaN(factor) ? 1 : factor

	let value = options.useVar ? Number(options.valueVar?.toString() ?? '') : Number(options.value)

	if (isInteger) value = Math.floor(value * effectiveFactor)

	if (isNaN(value) || Math.abs(value) > 0xffffffff) return undefined

	if (options.relative) {
		value = calcRelativeNumber(
			value,
			path,
			options.min?.toString() ?? '',
			options.max?.toString() ?? '',
			paramType,
			state,
		)
	}

	const param = state.parameters.get(path)
	return checkNumberLimits(value, param?.minimum ?? -0xffffffff, param?.maximum ?? 0xffffffff)
}

const parseEnumValue = (options: CompanionOptionValues, path: string, state: EmberPlusState): number | undefined => {
	if (options.asEnum) {
		const enumKey = options.enumValue?.toString() ?? ''
		const value = state.getEnumIndex(path, enumKey)
		if (value === null || value === undefined || value < 0) {
			throw new Error(`Index of ${enumKey} not found in enum table of ${path}`)
		}
		return value
	}

	let value = options.useVar ? Number.parseInt(options.valueVar?.toString() ?? '') : Math.floor(Number(options.value))

	if (isNaN(value) || value > 0xffffffff) throw new Error(`Invalid value: ${value}`)

	if (options.relative) {
		value = calcRelativeNumber(
			value,
			path,
			options.min?.toString() ?? '',
			options.max?.toString() ?? '',
			EmberModel.ParameterType.Enum,
			state,
		)
	}

	const param = state.parameters.get(path)
	return checkNumberLimits(value, param?.minimum ?? 0, param?.maximum ?? 0xffffffff)
}

const parseBooleanValue = (options: CompanionOptionValues, path: string, state: EmberPlusState): boolean => {
	if (options.toggle) {
		return !state.parameters.get(path)?.value
	}

	if (options.useVar) {
		const varValue = (options.valueVar?.toString() ?? '').toLowerCase()
		switch (varValue) {
			case 'true':
			case 'on':
			case '1':
				return true
			case 'false':
			case 'off':
			case '0':
				return false
			default:
				return Boolean(options.valueVar?.toString() ?? '')
		}
	}

	return Boolean(options.value)
}

const validateNodeAccess = (
	node: EmberModel.TreeElement<EmberModel.EmberElement>,
	path: string,
): node is EmberModel.NumberedTreeNode<EmberModel.Parameter> => {
	if (node.contents.type !== EmberModel.ElementType.Parameter) {
		throw new Error(`${path} is not a parameter`)
	}

	const { access } = node.contents
	if (access === EmberModel.ParameterAccess.None || access === EmberModel.ParameterAccess.Read) {
		throw new Error(`Can't write to ${path}: insufficient permissions (${access})`)
	}
	return true
}

const validateParameterType = (
	node: EmberModel.NumberedTreeNode<EmberModel.Parameter>,
	expectedType: EmberModel.ParameterType,
): boolean => {
	if (node.contents.parameterType !== expectedType) {
		return false
	}
	return true
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
	async (action: CompanionActionEvent, _context: CompanionActionContext): Promise<void> => {
		const path = resolveEventPath(action)
		const requiresVariableHandling = Boolean(
			action.options.variable || action.options.toggle || action.options.relative || action.options.asEnum,
		)

		const node = await self.registerNewParameter(path, requiresVariableHandling)

		if (!node || node.contents.type !== EmberModel.ElementType.Parameter) {
			throw new Error(`Parameter ${action.options.path} not found or not a parameter`)
		}

		if (!validateNodeAccess(node, path)) return

		await queue.add(async () => {
			if (!validateParameterType(node, paramType))
				throw new Error(`Node ${path} is not of type ${paramType} (is ${node.contents.parameterType})`)

			self.logger.debug('Got node on', path)

			let value: string | number | boolean | undefined

			switch (actionType) {
				case ActionId.SetValueString:
					value = parseStringValue(action.options)
					break
				case ActionId.SetValueInt:
					value = parseNumericValue(action.options, path, EmberModel.ParameterType.Integer, state, true)
					break
				case ActionId.SetValueReal:
					value = parseNumericValue(action.options, path, EmberModel.ParameterType.Real, state, false)
					break
				case ActionId.SetValueEnum:
					value = parseEnumValue(action.options, path, state)
					break
				case ActionId.SetValueBoolean:
					value = parseBooleanValue(action.options, path, state)
					break
				default:
					return
			}

			if (value === undefined) return

			const request = await emberClient.setValue(node, value, false)
			await request.response
		})
	}
