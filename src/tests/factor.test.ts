import { describe, it, expect } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { isValidFactor, withValidFactor } from '../factor.js'

describe('isValidFactor', () => {
	it.each([1, 10, 100])('takes %s, a positive whole number', (factor) => {
		expect(isValidFactor(factor)).toBe(true)
	})

	it.each([0, -1, -10, 2.5, Number.NaN, Infinity, undefined])('refuses %s', (factor) => {
		expect(isValidFactor(factor)).toBe(false)
	})
})

describe('withValidFactor', () => {
	const gain = (factor: number | undefined) =>
		({
			type: EmberModel.ElementType.Parameter,
			parameterType: EmberModel.ParameterType.Integer,
			value: 5,
			factor,
		}) as EmberModel.Parameter

	it('gives the parameter itself with a positive whole factor, or none', () => {
		const tenths = gain(10)
		expect(withValidFactor(tenths)).toBe(tenths)
		const none = gain(undefined)
		expect(withValidFactor(none)).toBe(none)
	})

	it('drops any other factor from a copy, leaving the parameter as it is', () => {
		const negative = gain(-10)
		expect(withValidFactor(negative)).toEqual({ ...negative, factor: undefined })
		expect(negative.factor).toBe(-10)
	})
})
