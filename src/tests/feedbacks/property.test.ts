import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import {
	learnParameterFeedbackOptions,
	parameterPropertyFeedbackCallback,
	resolveBooleanFeedback,
} from '../../feedbacks/parameter.js'
import { FeedbackId } from '../../feedback.js'
import { parameterProperty, parameterPropertyChoices, readsValue } from '../../feedbacks/property.js'
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
	// As the device reports it: neither a formula nor a factor applies
	describe('value', () => {
		it.each([
			['an integer with a factor', { value: 500, factor: 100 }, 500],
			['an integer with a formula', { value: 10, formula: '$ * 2 + 1\n($ - 1) / 2' }, 10],
			['a real with a factor', { parameterType: ParameterType.Real, value: 1.5, factor: 10 }, 1.5],
		])('gives %s as reported', (_name, fields, expected) => {
			expect(parameterProperty(parameter(fields), 'value')).toBe(expected)
		})

		it('gives an octet string as its bytes', () => {
			const octets = parameter({ parameterType: ParameterType.Octets, value: Buffer.from([1, 2, 3]) })
			expect(parameterProperty(octets, 'value')).toEqual([1, 2, 3])
		})

		it('gives null for a null value, and the value for a property a saved feedback left out', () => {
			expect(parameterProperty(parameter({ value: null }), 'value')).toBeNull()
			expect(parameterProperty(parameter({ value: 70, factor: 10 }), undefined)).toBe(70)
		})
	})

	// What the Set Value actions take, so a preset's rotary steps from it: the library's displayValue, the inverse of
	// the deviceValue they convert with
	describe('value by formula / factor', () => {
		it.each([
			['an integer by its factor', { value: -125, factor: 10 }, -12.5],
			['a real by its factor, as the library has it', { parameterType: ParameterType.Real, value: 5, factor: 2 }, 2.5],
			['by the formula, before the factor', { value: 10, formula: '$ * 2 + 1\n($ - 1) / 2', factor: 10 }, 21],
			['an integer by its formula, as an integer', { value: 7, formula: '$ \\ 2' }, 3],
			['a real by its formula, as a real', { parameterType: ParameterType.Real, value: 7, formula: '$ / 2' }, 3.5],
			['as it is with neither', { value: 7 }, 7],
		])('gives %s', (_name, fields, expected) => {
			expect(parameterProperty(parameter(fields), 'displayed')).toBe(expected)
		})

		it('gives the reported value for a formula it cannot compute, and logs why', () => {
			expect(parameterProperty(parameter({ value: 5, formula: '$ +' }), 'displayed')).toBe(5)
			expect(logs).toHaveBeenCalledWith('Feedbacks/Parameter Property', 'debug', expect.stringContaining('$ +'))
		})

		it('gives a value that is no number as it is', () => {
			expect(parameterProperty(parameter({ parameterType: ParameterType.Boolean, value: true }), 'displayed')).toBe(
				true,
			)
			expect(parameterProperty(parameter({ value: null }), 'displayed')).toBeNull()
		})

		// Value by Formula, of 3.0 pre-releases, was merged into it: an expression may still give its id
		it("is what the merged Value by Formula's id gives", () => {
			expect(parameterProperty(parameter({ value: 500, factor: 100 }), 'formula' as never)).toBe(5)
		})
	})

	// A factor of 0 divided by 0; a negative one turned the value round. Only a positive whole number is a factor
	describe('a factor that is no positive whole number', () => {
		it.each([0, -10, 2.5])('%s is ignored, as if the provider gave none', (factor) => {
			const gain = parameter({ value: 50, minimum: -100, maximum: 100, factor, format: '%d°dB' })
			expect(parameterProperty(gain, 'displayed')).toBe(50)
			expect(parameterProperty(gain, 'units')).toBe('50 dB')
			expect(parameterProperty(gain, 'displayedMinimum')).toBe(-100)
			expect(parameterProperty(gain, 'displayedStep')).toBe(1)
			// Still reported as it came
			expect(parameterProperty(gain, 'factor')).toBe(factor)
		})
	})

	// What a placed preset reads its range and step by, as the Set Value actions take values
	describe('range and step by formula / factor', () => {
		it("gives an integer's range and step by its factor", () => {
			const gain = parameter({ value: 0, minimum: -128, maximum: 127, factor: 10 })
			expect(parameterProperty(gain, 'displayedMinimum')).toBe(-12.8)
			expect(parameterProperty(gain, 'displayedMaximum')).toBe(12.7)
			// An integer's step is 1 unless it says otherwise
			expect(parameterProperty(gain, 'displayedStep')).toBe(0.1)
			expect(parameterProperty({ ...gain, step: 5 }, 'displayedStep')).toBe(0.5)
		})

		it('gives a range by its formula, lower first', () => {
			const inverted = parameter({
				parameterType: ParameterType.Real,
				minimum: 0,
				maximum: 100,
				formula: '0 - $\n0 - $',
			})
			expect(parameterProperty(inverted, 'displayedMinimum')).toBe(-100)
			expect(parameterProperty(inverted, 'displayedMaximum')).toBe(0)
		})

		it('gives a real without a step of its own no step', () => {
			const trim = parameter({ parameterType: ParameterType.Real, minimum: 0, maximum: 1 })
			expect(parameterProperty(trim, 'displayedStep')).toBeNull()
			expect(parameterProperty({ ...trim, step: 0.25 }, 'displayedStep')).toBe(0.25)
		})

		it("gives an enumeration's entries as its range where it states none", () => {
			const mode = parameter({ parameterType: ParameterType.Enum, enumeration: 'Off\nOn\nAuto' })
			expect(parameterProperty(mode, 'displayedMinimum')).toBe(0)
			expect(parameterProperty(mode, 'displayedMaximum')).toBe(2)
			expect(parameterProperty({ ...mode, maximum: 1 }, 'displayedMaximum')).toBe(1)
		})

		it('gives nothing without both limits, or for a type without a range', () => {
			expect(parameterProperty(parameter({ minimum: 0 }), 'displayedMaximum')).toBeNull()
			expect(
				parameterProperty(parameter({ parameterType: ParameterType.String, value: 'x' }), 'displayedMinimum'),
			).toBeNull()
		})
	})

	describe('identifier path', () => {
		it('names the parameter by the identifiers of it and the nodes above it', () => {
			const gain = new EmberModel.NumberedTreeNodeImpl(2, parameter({ identifier: 'Gain', value: 0 }))
			const inputs = new EmberModel.NumberedTreeNodeImpl(
				1,
				new EmberModel.EmberNodeImpl('Inputs'),
				EmberModel.childrenOf([gain]),
			)
			gain.parent = inputs
			expect(parameterProperty(gain.contents, 'identifierPath', gain)).toBe('Inputs.Gain')
			// Without its element, only its own identifier is known
			expect(parameterProperty(gain.contents, 'identifierPath')).toBe('Gain')
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

		it('gives the reported value without an enumeration or enumMap', () => {
			expect(parameterProperty(parameter({ value: 500, factor: 100 }), 'enumeration')).toBe(500)
		})

		it('gives the reported value for a value with no entry', () => {
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

	it('tells the properties that change with the value from those that change only with the parameter', () => {
		for (const property of ['value', 'units', 'displayed', 'enumeration'] as const) {
			expect(readsValue(property), property).toBe(true)
		}
		for (const property of ['identifierPath', 'displayedMinimum', 'displayedStep', 'access'] as const) {
			expect(readsValue(property), property).toBe(false)
		}
		// A saved feedback without one reads Value; one this version doesn't know is taken to read the value, as is
		// Value by Formula's id, merged into Value by Formula / Factor
		expect(readsValue(undefined)).toBe(true)
		expect(readsValue('formula' as never)).toBe(true)
		expect(readsValue('somethingNew' as never)).toBe(true)
	})

	it('offers Value by Formula / Factor once, and not Value by Formula', () => {
		const labels = parameterPropertyChoices.map((choice) => choice.label)
		expect(labels).toContain('Value by Formula / Factor')
		expect(labels).not.toContain('Value by Formula')
		expect(labels).not.toContain('Value as Displayed')
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
		// Value, the default, reads the value
		expect(self.useParameterForFeedback).toHaveBeenCalledWith('fb1', '1.2', ctx.signal, true)
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
