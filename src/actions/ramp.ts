import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionEvent,
	type CompanionActionLearnContext,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from '@phillipivan/emberplus-connection'
import type { RampValueOptions, SetValueOptions, StopRampOptions } from '../actions.js'
import type EmberPlusInstance from '../index.js'
import { describe } from '../logging.js'
import { EmberNumberRange } from '../ranges.js'
import { easingOf } from '../ramps.js'
import { EmberPlusState } from '../state.js'
import { withValidFactor } from '../factor.js'
import { checkNumberLimits, displayedNumber, resolveEventPath } from '../util.js'
import { learnDisplayedNumber, numericTarget, validateNodeAccess } from './parameter.js'

const logger = createModuleLogger('Actions/Ramp Value')

/**
 * How long Companion waits for an action before cancelling it, in ms: its default, as base 2.2 has no way to change it.
 * Base 2.3 adds the definition's executionTimeout; set it from this constant when updating, so the two can't drift
 */
export const RampWaitLimit = 5000

/**
 * What a ramp the action waits for leaves of the limit: Companion's timer starts before the module is called, and the
 * final step waits for the provider's reply. 500 ms, agreed with the user on 2026-11-26
 */
export const RampWaitMargin = 500

type RampParameterType = EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real

function isRampType(type: EmberModel.ParameterType): type is RampParameterType {
	return type === EmberModel.ParameterType.Integer || type === EmberModel.ParameterType.Real
}

/**
 * Ramp an Integer or Real parameter to a value, as displayed, over a time. A ramp on the same path stops, and this one
 * starts from where it had reached. The action waits for the ramp to end when that fits within Companion's time limit
 * for an action, counting the time already taken (registering the parameter on a first press); a longer ramp carries on
 * after the action has completed.
 */
export const rampValue =
	(self: EmberPlusInstance, emberClient: EmberClient, state: EmberPlusState) =>
	async (action: CompanionActionEvent<RampValueOptions>, context: CompanionActionCallbackContext): Promise<void> => {
		const entered = self.ramps.now()
		const path = resolveEventPath(action)
		const node = await self.registerNewParameter(path, context.signal)
		if (!node || node.contents.type !== EmberModel.ElementType.Parameter) {
			throw new Error(`Parameter ${path} not found or not a parameter`)
		}
		validateNodeAccess(node, path)
		const paramType = node.contents.parameterType
		if (!isRampType(paramType)) {
			throw new Error(`Ramp Value: ${path} is not an Integer or Real parameter (is ${paramType})`)
		}

		// What the provider has reported, merged; the node's contents until a report has come in
		const parameter = state.parameters.get(path) ?? node.contents
		// A running ramp is ahead of the reports, which come in behind its steps: start from where it has reached
		const from = self.ramps.position(path) ?? displayedNumber(parameter)
		if (from === undefined) throw new Error(`Ramp Value: ${path} has no current value to ramp from`)

		const target = numericTarget(action.options, parameter, paramType, from)
		if (target === undefined) return
		const to = displayedNumber({ ...parameter, value: target } as EmberModel.Parameter) ?? target

		const range = EmberNumberRange[paramType]
		const toDevice = (displayed: number): number => {
			const value = EmberModel.deviceValue(withValidFactor(parameter), displayed)
			if (isNaN(value)) throw new Error(`${displayed} gives no device value`)
			return checkNumberLimits(
				checkNumberLimits(value, range.min, range.max),
				parameter.minimum ?? range.min,
				parameter.maximum ?? range.max,
			)
		}

		const send = async (value: number, final: boolean): Promise<void> => {
			// A step meant for a client a host change has replaced isn't sent to the new provider
			if (!self.isCurrentClient(emberClient)) return
			// The final step waits for the provider's reply; the steps before it don't
			const request = await emberClient.setValue(node, value, final)
			if (final) await request.response
		}

		const duration = Number(action.options.duration)
		const handle = self.ramps.start(path, {
			from,
			to,
			target,
			duration,
			easing: easingOf(action.options.easing),
			toDevice,
			send,
		})

		const timeLeft = RampWaitLimit - (self.ramps.now() - entered) - RampWaitMargin
		if (!(duration <= timeLeft)) {
			logger.debug(
				`Ramp on ${path} over ${duration} ms runs past the ${Math.max(0, Math.round(timeLeft))} ms left to wait, so it finishes after the action has completed`,
			)
			handle.done.catch((e: unknown) => logger.warn(`Ramp on ${path}: the final value failed: ${describe(e)}`))
			return
		}

		// Companion's "abort actions" stops a ramp the action is waiting for
		const stop = () => handle.cancel()
		context.signal.addEventListener('abort', stop, { once: true })
		try {
			await handle.done
		} finally {
			context.signal.removeEventListener('abort', stop)
		}
	}

/** Stop the ramp on a path, or every ramp, where it has reached */
export const stopRamp =
	(self: EmberPlusInstance) =>
	(action: CompanionActionEvent<StopRampOptions>, _context: CompanionActionCallbackContext): void => {
		if (action.options.all) self.ramps.cancelAll()
		else self.ramps.cancel(resolveEventPath(action))
	}

/** Learn the parameter's current value as displayed, and its limits, as Set Value Integer and Set Value Real do */
export const learnRampValue =
	(state: EmberPlusState) =>
	(
		action: CompanionActionEvent<RampValueOptions>,
		_context: CompanionActionLearnContext,
	): Partial<RampValueOptions> | undefined => {
		const path = resolveEventPath(action)
		const parameter = state.parameters.get(path)
		if (!parameter || !isRampType(parameter.parameterType)) return undefined
		const learned: SetValueOptions = {}
		learnDisplayedNumber(learned, parameter, path)
		// Only the keys a Ramp Value has: the value and the limits, all numbers
		const { value, min, max } = learned
		return {
			...(typeof value === 'number' ? { value } : {}),
			...(min === undefined ? {} : { min }),
			...(max === undefined ? {} : { max }),
		}
	}
