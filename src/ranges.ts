import { Model as EmberModel } from '@phillipivan/emberplus-connection'

/** The parameter types the Set Value actions set as numbers */
export type NumericParameterType =
	EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real | EmberModel.ParameterType.Enum

/**
 * The values Ember+ allows a parameter of each numeric type, as far as a JavaScript number holds them exactly. Glow
 * gives an integer 64 bits, which a number holds exactly up to ±(2^53 - 1); an enumeration's value is the index of an
 * entry, so from 0; a REAL is a double, as a number is.
 */
export const EmberNumberRange: Record<NumericParameterType, { min: number; max: number }> = {
	[EmberModel.ParameterType.Integer]: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
	[EmberModel.ParameterType.Enum]: { min: 0, max: Number.MAX_SAFE_INTEGER },
	[EmberModel.ParameterType.Real]: { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
}

/**
 * The numbers Ember+ allows a matrix target or source: Glow gives a signal's number and a connection's target as an
 * Integer32, and its sources as a RELATIVE-OID, whose numbers the library holds to the same 2^31 - 1.
 */
export const EmberSignalRange = { min: 0, max: 0x7fffffff } as const

/** Whether a number is a matrix target or source Ember+ allows */
export function isSignalNumber(value: number): boolean {
	return Number.isInteger(value) && value >= EmberSignalRange.min && value <= EmberSignalRange.max
}
