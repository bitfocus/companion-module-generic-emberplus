import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionContext,
	type CompanionActionEvent,
	type CompanionActionInfo,
	type CompanionActionLearnContext,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, type SetValueOptions } from '../actions.js'
import type EmberPlusInstance from '../index.js'
import { enumEntries } from '../enums.js'
import { describe } from '../logging.js'
import { EmberNumberRange } from '../ranges.js'
import { EmberPlusState } from '../state.js'
import {
	calcRelativeNumber,
	checkNumberLimits,
	displayedNumber,
	isDefined,
	parseEscapeCharacters,
	resolveEventPath,
	substituteEscapeCharacters,
} from '../util.js'
import { withValidFactor } from '../factor.js'

const logger = createModuleLogger('Actions/Set Value')

export const subscribeParameterAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionInfo<SetValueOptions>, _context: CompanionActionContext): Promise<void> => {
		await self.registerNewParameter(resolveEventPath(action))
	}

const learnNumericOptions = (learned: SetValueOptions, emberPath: EmberModel.Parameter): void => {
	if (isDefined(emberPath.value)) learned.value = Number(emberPath.value)
	if (isDefined(emberPath.minimum)) learned.min = emberPath.minimum
	if (isDefined(emberPath.maximum)) learned.max = emberPath.maximum
}

/**
 * Learn an Integer or Real parameter's value as displayed: by its formula, or else its factor, with its limits. A
 * formula that can't be computed leaves the device's value learned, as the recorder and the variables do. Returns
 * whether the displayed value was learned
 */
export const learnDisplayedNumber = (
	learned: SetValueOptions,
	emberPath: EmberModel.Parameter,
	path: string,
): boolean => {
	learnNumericOptions(learned, emberPath)
	let displayed: number | undefined
	try {
		displayed = displayedNumber(emberPath)
	} catch (e) {
		logger.debug(`Learn: the formula of ${path} can't be computed, so its device value is learned: ${describe(e)}`)
	}
	if (displayed === undefined) return false
	learned.value = displayed
	return true
}

/**
 * Learn the parameter's current value (a number as displayed, by its formula or factor), its limits, and an
 * enumeration's entry. Returns only what was learned, so an expression in the path is kept.
 */
export const learnSetValueActionOptions =
	<TOptions extends SetValueOptions>(
		state: EmberPlusState,
		paramType: EmberModel.ParameterType,
		actionType: ActionId,
	) =>
	async (
		action: CompanionActionEvent<TOptions>,
		_context: CompanionActionLearnContext,
	): Promise<Partial<TOptions> | undefined> => {
		const path = resolveEventPath(action)
		const emberPath = state.parameters.get(path)

		if (!emberPath || paramType !== emberPath.parameterType) return undefined

		const learned: SetValueOptions = {}
		const { value } = emberPath

		switch (actionType) {
			case ActionId.SetValueString:
				if (isDefined(value)) {
					learned.value = action.options.parseEscapeChars
						? substituteEscapeCharacters(value.toString())
						: value.toString()
				}
				break

			case ActionId.SetValueBoolean:
				if (isDefined(value)) learned.value = Boolean(value)
				break

			case ActionId.SetValueEnum: {
				learnNumericOptions(learned, emberPath)
				if (!isDefined(emberPath.minimum)) learned.min = 0
				const entry = state.getCurrentEnumValue(path)
				if (entry !== '') learned.enumValue = entry
				break
			}

			case ActionId.SetValueInt:
			case ActionId.SetValueReal: {
				// With Device Units, the device's value, sent as it is
				if (action.options.deviceUnits) {
					learnNumericOptions(learned, emberPath)
					break
				}
				// As displayed; for a formula that can't be computed, the device's value, so in device units
				if (!learnDisplayedNumber(learned, emberPath, path) && isDefined(emberPath.value)) learned.deviceUnits = true
				break
			}

			default:
				return undefined
		}

		// Each case sets only the keys its action's options have, with the types they have there
		return learned as Partial<TOptions>
	}

const parseStringValue = (options: SetValueOptions): string => {
	let value = options.value?.toString() ?? ''
	if (options.parseEscapeChars) value = parseEscapeCharacters(value)
	return value
}

/** A relative action's own limits, in the device's units; one missing (an action saved without it) is no limit */
const withinRelativeLimits = (value: number, options: Pick<SetValueOptions, 'min' | 'max'>): number =>
	checkNumberLimits(value, options.min ?? -Infinity, options.max ?? Infinity)

/**
 * The device value for an Integer or Real action. The value given is as displayed, and the parameter's formula, or else
 * its factor, converts it (the library's deviceValue, which rounds an integer); a relative change is added to the
 * displayed value first. Throws FormulaError for a formula that can't be computed, or has no second expression.
 */
const parseNumericValue = (
	options: SetValueOptions,
	path: string,
	parameter: EmberModel.Parameter,
	paramType: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real,
	state: EmberPlusState,
): number | undefined => {
	if (options.deviceUnits) return parseDeviceUnitsValue(options, path, parameter, paramType, state)
	// The current value is only read for a relative change: a formula that can't be computed fails only those
	return numericTarget(options, parameter, paramType, options.relative ? displayedNumber(parameter) : undefined)
}

/**
 * The device value an Integer or Real action's options give: the value as displayed, or for a relative change that
 * amount added to the current displayed value given, converted by the parameter's formula or factor (the library's
 * deviceValue, which rounds an integer), then held to the action's limits (device units), the type's range and the
 * parameter's minimum and maximum. Undefined for no value, or a value set outright beyond the type's range. Throws
 * FormulaError for a formula that can't be computed, or has no second expression.
 */
export const numericTarget = (
	options: Pick<SetValueOptions, 'value' | 'relative' | 'min' | 'max'>,
	parameter: EmberModel.Parameter,
	paramType: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real,
	current: number | undefined,
): number | undefined => {
	let displayed = Number(options.value)
	if (isNaN(displayed)) return undefined
	if (options.relative) displayed += current ?? 0

	let value = EmberModel.deviceValue(withValidFactor(parameter), displayed)
	if (isNaN(value)) return undefined

	const range = EmberNumberRange[paramType]
	// A value set outright beyond the range Ember+ allows isn't sent; a relative change stops at the range's ends
	if (!options.relative && (value < range.min || value > range.max)) return undefined
	if (options.relative) value = withinRelativeLimits(value, options)
	value = checkNumberLimits(value, range.min, range.max)
	return checkNumberLimits(value, parameter.minimum ?? range.min, parameter.maximum ?? range.max)
}

/**
 * The device value for an action in the device's units (Device Units): the value as it is, bypassing the parameter's
 * formula and factor, with a relative change added to the device's value. An Integer's is rounded to a whole number,
 * as a displayed value is; a Real's is sent as it is
 */
const parseDeviceUnitsValue = (
	options: SetValueOptions,
	path: string,
	parameter: EmberModel.Parameter,
	paramType: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real,
	state: EmberPlusState,
): number | undefined => {
	let value = Number(options.value)
	if (paramType === EmberModel.ParameterType.Integer) value = Math.round(value)
	const range = EmberNumberRange[paramType]
	if (isNaN(value) || value < range.min || value > range.max) return undefined
	if (options.relative) value = calcRelativeNumber(value, path, options.min, options.max, paramType, state)
	return checkNumberLimits(value, parameter.minimum ?? range.min, parameter.maximum ?? range.max)
}

/**
 * A relative change of an enumeration, by its entries (the library's enumEntries) rather than its value, so that an
 * enumMap's values, which needn't be consecutive, are stepped through in order. Each step moves to the next entry in its
 * direction within the action's own limits; a hidden entry is one like any other (see enums.ts). The steps start from
 * the current entry, within the limits or not, or from before the first or after the last for a value with no entry.
 * Where no entry within the limits lies that way, the change stops at the nearest one. Undefined for a parameter
 * without entries within the limits.
 */
function stepEnumEntries(parameter: EmberModel.Parameter, steps: number, options: SetValueOptions): number | undefined {
	const entries = enumEntries(parameter)
	const settable = (index: number) => {
		const entry = entries[index]
		return entry !== undefined && withinRelativeLimits(entry.value, options) === entry.value
	}
	if (!entries.some((_entry, index) => settable(index))) return undefined

	const direction = steps < 0 ? -1 : 1
	const found = entries.findIndex((entry) => entry.value === parameter.value)
	let index = found >= 0 ? found : direction > 0 ? -1 : entries.length
	let moved = false
	for (let remaining = Math.abs(steps); remaining > 0; remaining--) {
		let next = index + direction
		while (next >= 0 && next < entries.length && !settable(next)) next += direction
		if (next < 0 || next >= entries.length) break
		index = next
		moved = true
	}
	if (moved || settable(index)) return entries[index]?.value

	// None that way (or no step): the nearest settable entry, that way first
	for (const way of [direction, -direction]) {
		for (let next = index + way; next >= 0 && next < entries.length; next += way) {
			if (settable(next)) return entries[next]?.value
		}
	}
	return undefined
}

const parseEnumValue = (
	options: SetValueOptions,
	path: string,
	parameter: EmberModel.Parameter,
	state: EmberPlusState,
): number | undefined => {
	if (options.asEnum) {
		const name = options.enumValue ?? ''
		const value = state.getEnumValue(path, name)
		if (value === undefined) throw new Error(`No entry ${name} in the enumeration of ${path}`)
		return value
	}

	let value = Math.floor(Number(options.value))

	const range = EmberNumberRange[EmberModel.ParameterType.Enum]
	// Negative only as a relative change
	if (isNaN(value) || Math.abs(value) > range.max) throw new Error(`Invalid value: ${value}`)

	if (options.relative) {
		value =
			stepEnumEntries(parameter, value, options) ??
			calcRelativeNumber(value, path, options.min, options.max, EmberModel.ParameterType.Enum, state)
	}

	return checkNumberLimits(value, parameter.minimum ?? range.min, parameter.maximum ?? range.max)
}

const parseBooleanValue = (options: SetValueOptions, path: string, state: EmberPlusState): boolean => {
	if (options.toggle) {
		return !state.parameters.get(path)?.value
	}

	return Boolean(options.value)
}

/** Check a node is a parameter the module may write to, throwing if not */
export function validateNodeAccess(
	node: EmberModel.TreeElement<EmberModel.EmberElement>,
	path: string,
): asserts node is EmberTypes.ElementOf<EmberModel.Parameter> {
	if (
		node.contents.type !== EmberModel.ElementType.Parameter ||
		!(EmberModel.isNumbered(node) || EmberModel.isQualified(node))
	) {
		throw new Error(`${path} is not a parameter`)
	}

	const { access } = node.contents
	if (access === EmberModel.ParameterAccess.None || access === EmberModel.ParameterAccess.Read) {
		throw new Error(`Can't write to ${path}: insufficient permissions (${access})`)
	}
}

const validateParameterType = (
	node: EmberTypes.ElementOf<EmberModel.Parameter>,
	expectedType: EmberModel.ParameterType,
): boolean => {
	return node.contents.parameterType === expectedType
}

export const setValue =
	<TOptions extends SetValueOptions>(
		self: EmberPlusInstance,
		emberClient: EmberClient,
		paramType: EmberModel.ParameterType,
		actionType: ActionId,
		state: EmberPlusState,
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent<TOptions>, context: CompanionActionCallbackContext): Promise<void> => {
		const path = resolveEventPath(action)
		// A ramp on the path would overwrite the value set with its next step
		self.ramps.cancel(path)
		const node = await self.registerNewParameter(path, context.signal)

		if (!node || node.contents.type !== EmberModel.ElementType.Parameter) {
			throw new Error(`Parameter ${path} not found or not a parameter`)
		}

		validateNodeAccess(node, path)
		if (!validateParameterType(node, paramType))
			throw new Error(`Node ${path} is not of type ${paramType} (is ${node.contents.parameterType})`)

		await queue.add(
			async () => {
				logger.debug(`Got node on ${path}`)
				// What the provider has reported, merged, read once the action's turn has come: a relative change made from
				// a value read before waiting in the queue would miss what an earlier action, or the device, changed meanwhile.
				// The node's contents until a report has come in
				const parameter = state.parameters.get(path) ?? node.contents

				let value: string | number | boolean | undefined

				switch (actionType) {
					case ActionId.SetValueString:
						value = parseStringValue(action.options)
						break
					case ActionId.SetValueInt:
						value = parseNumericValue(action.options, path, parameter, EmberModel.ParameterType.Integer, state)
						break
					case ActionId.SetValueReal:
						value = parseNumericValue(action.options, path, parameter, EmberModel.ParameterType.Real, state)
						break
					case ActionId.SetValueEnum:
						value = parseEnumValue(action.options, path, parameter, state)
						break
					case ActionId.SetValueBoolean:
						value = parseBooleanValue(action.options, path, state)
						break
					default:
						return
				}

				if (value === undefined) return

				// The library sends only the path and the value (#43: the whole cached parameter used to go back, which a Lawo
				// Powercore refused), and refuses a value that doesn't fit the parameter's type. The tree, and state.parameters,
				// change when the provider reports the new value.
				const request = await emberClient.setValue(node, value, false)
				await request.response
			},
			{ signal: context.signal },
		)
	}
