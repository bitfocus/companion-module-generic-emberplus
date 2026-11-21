import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import {
	learnParameterFeedbackOptions,
	parameterPropertyFeedbackCallback,
	resolveBooleanFeedback,
} from '../../feedbacks/parameter.js'
import { FeedbackId } from '../../feedback.js'
import { parameterProperty, parameterPropertyChoices } from '../../feedbacks/property.js'
import { EmberPlusState } from '../../state.js'
import { captureLogs } from '../logs.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other tests do
vi.mock('../../actions.js', () => ({ ActionId: {} }))

const { ParameterType, ParameterAccess, StreamFormat } = EmberModel

const logs = captureLogs()

const ctx = { signal: new AbortController().signal } as any

/** A parameter as the library reports one: only the fields given */
function parameter(fields: Partial<EmberModel.TypedParameter<EmberModel.ParameterType>>): EmberModel.Parameter {
	return {
		type: EmberModel.ElementType.Parameter,
		parameterType: ParameterType.Integer,
		...fields,
	} as EmberModel.Parameter
}

describe('parameterProperty', () => {
	describe('value', () => {
		// As Parameter Value always gave it, so upgraded feedbacks don't change
		it('divides an integer by its factor', () => {
			expect(parameterProperty(parameter({ value: 500, factor: 100 }), 'value')).toBe(5)
		})

		it('leaves a real as it is, factor or not', () => {
			expect(parameterProperty(parameter({ parameterType: ParameterType.Real, value: 1.5, factor: 10 }), 'value')).toBe(
				1.5,
			)
		})

		it('gives an octet string as its bytes', () => {
			const octets = parameter({ parameterType: ParameterType.Octets, value: Buffer.from([1, 2, 3]) })
			expect(parameterProperty(octets, 'value')).toEqual([1, 2, 3])
		})

		it('gives null for a null value, and for a property a saved feedback left out', () => {
			expect(parameterProperty(parameter({ value: null }), 'value')).toBeNull()
			expect(parameterProperty(parameter({ value: 7 }), undefined)).toBe(7)
		})
	})

	describe('value by formula', () => {
		it('computes the formula, provider to consumer', () => {
			expect(parameterProperty(parameter({ value: 10, formula: '$ * 2 + 1\n($ - 1) / 2' }), 'formula')).toBe(21)
		})

		it('computes an integer parameter as an integer, a real as a real', () => {
			expect(parameterProperty(parameter({ value: 7, formula: '$ \\ 2' }), 'formula')).toBe(3)
			expect(
				parameterProperty(parameter({ parameterType: ParameterType.Real, value: 7, formula: '$ / 2' }), 'formula'),
			).toBe(3.5)
		})

		it('gives the plain value without a formula', () => {
			expect(parameterProperty(parameter({ value: 500, factor: 100 }), 'formula')).toBe(5)
		})

		it('gives the plain value for a formula it cannot parse, and logs why', () => {
			expect(parameterProperty(parameter({ value: 5, formula: '$ +' }), 'formula')).toBe(5)
			expect(logs).toHaveBeenCalledWith('Feedbacks/Parameter Property', 'debug', expect.stringContaining('$ +'))
		})
	})

	describe('value with units', () => {
		it("formats the factored value, then the unit after the format's °", () => {
			expect(parameterProperty(parameter({ value: -125, factor: 10, format: '%.1f°dB' }), 'units')).toBe('-12.5 dB')
		})

		it('computes the formula before the format', () => {
			const withFormula = parameter({
				parameterType: ParameterType.Real,
				value: 2,
				formula: '$ * 10\n$ / 10',
				format: '%.2f° ms',
			})
			expect(parameterProperty(withFormula, 'units')).toBe('20.00 ms')
		})

		it('puts one space before the unit, as the format had one or not', () => {
			expect(parameterProperty(parameter({ value: -125, factor: 10, format: '%.1f° dB' }), 'units')).toBe('-12.5 dB')
		})

		it('keeps the text of a format without a unit marker', () => {
			expect(parameterProperty(parameter({ value: 3, format: '%d Units' }), 'units')).toBe('3 Units')
		})

		it('gives the value as text without a unit', () => {
			expect(parameterProperty(parameter({ value: 3 }), 'units')).toBe('3')
		})

		it('gives null without a value', () => {
			expect(parameterProperty(parameter({ value: null, format: '%d°dB' }), 'units')).toBeNull()
		})
	})

	describe('value as enumeration entry', () => {
		it('names the entry from the enumeration', () => {
			const enumerated = parameter({ parameterType: ParameterType.Enum, value: 1, enumeration: 'Off\nOn\n~Hidden' })
			expect(parameterProperty(enumerated, 'enumeration')).toBe('On')
		})

		// As the device names it, and as Return ENUM gave it before 3.0
		it('names a hidden entry with its ~', () => {
			const enumerated = parameter({ parameterType: ParameterType.Enum, value: 2, enumeration: 'Off\nOn\n~Hidden' })
			expect(parameterProperty(enumerated, 'enumeration')).toBe('~Hidden')
			expect(parameterProperty(enumerated, 'units')).toBe('~Hidden')
		})

		it('names the entry from the enumMap, before the enumeration', () => {
			const mapped = parameter({
				parameterType: ParameterType.Enum,
				value: 10,
				enumeration: 'Off\nOn',
				enumMap: new Map([
					['Mute', 10],
					['Live', 20],
				]),
			})
			expect(parameterProperty(mapped, 'enumeration')).toBe('Mute')
		})

		it('gives the plain value without an enumeration or enumMap', () => {
			expect(parameterProperty(parameter({ value: 500, factor: 100 }), 'enumeration')).toBe(5)
		})

		it('gives the plain value for a value with no entry', () => {
			const enumerated = parameter({ parameterType: ParameterType.Enum, value: 5, enumeration: 'Off\nOn' })
			expect(parameterProperty(enumerated, 'enumeration')).toBe(5)
		})
	})

	describe("the parameter's own fields", () => {
		const full = parameter({
			identifier: 'gain',
			description: 'Gain',
			value: 3,
			minimum: -10,
			maximum: null,
			access: ParameterAccess.ReadWrite,
			format: '%d°dB',
			factor: 10,
			step: 2,
			isOnline: true,
			defaultValue: 0,
			streamIdentifier: 4,
			streamDescriptor: { format: StreamFormat.Int16BE, offset: 2 },
			schemaIdentifiers: 'de.l-s-b.emberplus.gain',
			templateReference: '1.9',
		})

		it.each([
			['identifier', 'gain'],
			['description', 'Gain'],
			['parameterType', ParameterType.Integer],
			['access', ParameterAccess.ReadWrite],
			['minimum', -10],
			['maximum', null],
			['defaultValue', 0],
			['factor', 10],
			['format', '%d°dB'],
			['step', 2],
			['isOnline', true],
			['streamIdentifier', 4],
			['streamDescriptor', { format: StreamFormat.Int16BE, offset: 2 }],
			['schemaIdentifiers', 'de.l-s-b.emberplus.gain'],
			['templateReference', '1.9'],
		] as const)('gives %s as the provider reported it', (property, expected) => {
			expect(parameterProperty(full, property)).toEqual(expected)
		})

		it('gives null for a field the provider left out', () => {
			expect(parameterProperty(parameter({ value: 1 }), 'description')).toBeNull()
			expect(parameterProperty(parameter({ value: 1 }), 'streamDescriptor')).toBeNull()
		})
	})

	it('has a choice for every property, and returns each without throwing', () => {
		for (const { id } of parameterPropertyChoices) {
			expect(() => parameterProperty(parameter({ value: 1 }), id)).not.toThrow()
		}
	})
})

describe('parameterPropertyFeedbackCallback', () => {
	function setup(registered = true) {
		const state = new EmberPlusState()
		const self = {
			useParameterForFeedback: vi.fn(async (id: string, path: string) => {
				if (registered) state.addIdToPathMap(id, path)
				return registered
			}),
		} as any
		return { state, self }
	}

	it('returns the chosen property of the parameter at the path', async () => {
		const { state, self } = setup()
		state.parameters.set('1.2', parameter({ value: 1, enumeration: 'Off\nOn' }))
		const result = await parameterPropertyFeedbackCallback(self, state)(
			{ id: 'fb1', options: { path: '1.2', property: 'enumeration' } } as any,
			ctx,
		)
		expect(result).toBe('On')
	})

	it('registers the path, and follows it for rechecks', async () => {
		const { state, self } = setup()
		await parameterPropertyFeedbackCallback(self, state)({ id: 'fb1', options: { path: '1.2' } } as any, ctx)
		expect(self.useParameterForFeedback).toHaveBeenCalledWith('fb1', '1.2', ctx.signal)
		expect(state.getFeedbacksByPath('1.2').has('fb1')).toBe(true)
	})

	it('returns null for a path with no parameter', async () => {
		const { state, self } = setup(false)
		const result = await parameterPropertyFeedbackCallback(self, state)(
			{ id: 'fb1', options: { path: '9.9' } } as any,
			ctx,
		)
		expect(result).toBeNull()
		expect(state.getFeedbacksByPath('9.9').size).toBe(0)
	})
})

// The deprecated feedbacks, against the real state and the library's enumEntries
describe('deprecated parameter feedbacks', () => {
	function stateWith(fields: Record<string, unknown>) {
		const state = new EmberPlusState()
		state.updateParameterMap('1.2', { number: 2, contents: parameter(fields) } as never)
		return state
	}

	// enumEntries names a hidden entry without its "~"; a value saved with it, as before 3.0, must still match
	it.each(['Muted', '~Muted'])('ENUM Equals String matches a hidden entry by %j', async (name) => {
		const state = stateWith({ parameterType: ParameterType.Enum, value: 1, enumeration: 'Off\n~Muted\nOn' })
		expect(await resolveBooleanFeedback(state, ParameterType.Enum, '1.2', name)).toBe(true)
		expect(await resolveBooleanFeedback(state, ParameterType.Enum, '1.2', 'On')).toBe(false)
	})

	it('ENUM Equals String matches an enumMap entry', async () => {
		const enumMap = new Map([
			['Mute', 10],
			['Live', 20],
		])
		const state = stateWith({ parameterType: ParameterType.Enum, value: 20, enumMap })
		expect(await resolveBooleanFeedback(state, ParameterType.Enum, '1.2', 'Live')).toBe(true)
	})

	// The feedback compares floor(value x factor) with the device value: learning the parameter's factor applied it twice
	it('Compare Number learns a feedback that matches the current value', async () => {
		const state = stateWith({ value: 150, factor: 10 })
		const feedback = { id: 'fb1', options: { path: '1.2', comparitor: 'eq' } } as any
		const learned = await learnParameterFeedbackOptions(state, FeedbackId.Parameter)(feedback, ctx)
		const options = { comparitor: 'eq' as any, factor: learned?.factor }
		expect(await resolveBooleanFeedback(state, ParameterType.Integer, '1.2', learned?.value as number, options)).toBe(
			true,
		)
	})
})
