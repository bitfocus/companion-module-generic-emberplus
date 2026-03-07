import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	subscribeParameterFeedback,
	unsubscribeParameterFeedback,
	learnParameterFeedbackOptions,
	resolveBooleanFeedback,
	parameterFeedbackCallback,
	parameterValueFeedbackCallback,
} from './parameter.js'
import { FeedbackId } from '../feedback.js'
import { compareNumber, parseEscapeCharacters } from '../util.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('emberplus-connection', () => ({
	Model: {
		ParameterType: {
			Boolean: 'boolean',
			Integer: 'integer',
			Real: 'real',
			Enum: 'enum',
			String: 'string',
		},
	},
}))

vi.mock('emberplus-connection/dist/model', () => ({
	ParameterType: {
		Boolean: 'boolean',
		Integer: 'integer',
		Real: 'real',
		Enum: 'enum',
		String: 'string',
	},
}))

vi.mock('../feedback', () => ({
	FeedbackId: {
		Boolean: 'boolean',
		Parameter: 'parameter',
		String: 'string',
		ENUM: 'enum',
	},
}))

vi.mock('../util', () => ({
	resolveEventPath: vi.fn((feedback) => feedback.options.path ?? '0.1'),
	compareNumber: vi.fn(() => true),
	parseEscapeCharacters: vi.fn((s) => s),
	substituteEscapeCharacters: vi.fn((s) => s + '_sub'),
	NumberComparitor: {
		Equal: 'eq',
		NotEqual: 'ne',
		LessThan: 'lt',
		LessThanEqual: 'lte',
		GreaterThan: 'gt',
		GreaterThanEqual: 'gte',
	},
}))

vi.mock('../state', () => ({
	EmberPlusState: class {
		parameters = new Map()
		addIdToPathMap = vi.fn()
		getCurrentEnumValue = vi.fn()
		getParameter = vi.fn()
	},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockState {
	parameters: Map<string, any>
	addIdToPathMap: ReturnType<typeof vi.fn>
	getCurrentEnumValue: ReturnType<typeof vi.fn>
}

function makeState(overrides: Partial<MockState> = {}): any {
	return {
		parameters: new Map<string, any>(),
		addIdToPathMap: vi.fn(),
		getCurrentEnumValue: vi.fn(() => 'On'),
		...overrides,
	}
}

function makeSelf(overrides: Record<string, any> = {}) {
	return {
		registerNewParameter: vi.fn().mockResolvedValue(false),
		...overrides,
	} as any
}

function makeFeedback(path = '0.1', options: Record<string, any> = {}) {
	return {
		id: 'fb1',
		options: { path, ...options },
	} as any
}

const ctx = {} as any

// ---------------------------------------------------------------------------
// subscribeParameterFeedback
// ---------------------------------------------------------------------------

describe('subscribeParameterFeedback', () => {
	it('calls registerNewParameter with the resolved path', async () => {
		const state = makeState()
		const self = makeSelf({ registerNewParameter: vi.fn().mockResolvedValue(true) })
		const fn = subscribeParameterFeedback(state, self)
		await fn(makeFeedback('0.1'), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('adds feedback id to path map when registerNewParameter returns true', async () => {
		const state = makeState()
		const self = makeSelf({ registerNewParameter: vi.fn().mockResolvedValue(true) })
		await subscribeParameterFeedback(state, self)(makeFeedback('0.1'), ctx)
		expect(state.addIdToPathMap).toHaveBeenCalledWith('fb1', '0.1')
	})

	it('does not add to path map when registerNewParameter returns false', async () => {
		const state = makeState()
		const self = makeSelf({ registerNewParameter: vi.fn().mockResolvedValue(false) })
		await subscribeParameterFeedback(state, self)(makeFeedback('0.1'), ctx)
		expect(state.addIdToPathMap.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// unsubscribeParameterFeedback
// ---------------------------------------------------------------------------

describe('unsubscribeParameterFeedback', () => {
	it('maps feedback id to empty string to remove it', async () => {
		const state = makeState()
		await unsubscribeParameterFeedback(state)(makeFeedback('0.1'), ctx)
		expect(state.addIdToPathMap).toHaveBeenCalledWith('fb1', '')
	})
})

// ---------------------------------------------------------------------------
// learnParameterFeedbackOptions
// ---------------------------------------------------------------------------

describe('learnParameterFeedbackOptions', () => {
	it('returns undefined when path has no parameter', async () => {
		const state = makeState()
		const fn = learnParameterFeedbackOptions(state, FeedbackId.String)
		const result = await fn(makeFeedback('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('returns undefined when parameter value is undefined', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: undefined })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.String)(makeFeedback('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('String: sets options.value to the raw string value', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const feedback = makeFeedback('0.1', { parseEscapeChars: false })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.String)(feedback, ctx)
		expect(result?.value).toBe('hello')
	})

	it('String: substitutes escape characters when parseEscapeChars is true', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const feedback = makeFeedback('0.1', { parseEscapeChars: true })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.String)(feedback, ctx)
		expect(result?.value).toBe('hello_sub')
	})

	it('ENUM: returns undefined when enumVal is empty string', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 0 })
		state.getCurrentEnumValue.mockReturnValue('')
		const result = await learnParameterFeedbackOptions(state, FeedbackId.ENUM)(makeFeedback('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('ENUM: sets options.value to the current enum string', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 1 })
		state.getCurrentEnumValue.mockReturnValue('On')
		const result = await learnParameterFeedbackOptions(state, FeedbackId.ENUM)(makeFeedback('0.1'), ctx)
		expect(result?.value).toBe('On')
	})

	it('Parameter: returns undefined when value is not a number', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'not-a-number' })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.Parameter)(makeFeedback('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('Parameter: sets value, valueVar, and asInt correctly for Integer type', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 42, parameterType: 'integer', factor: 100 })
		const feedback = makeFeedback('0.1', { factor: '1' })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.Parameter)(feedback, ctx)
		expect(result?.value).toBe(42)
		expect(result?.valueVar).toBe('42')
		expect(result?.asInt).toBe(true)
		expect(result?.factor).toBe('100')
	})

	it('Parameter: asInt is false for Real type', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 3.14, parameterType: 'real' })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.Parameter)(makeFeedback('0.1'), ctx)
		expect(result?.asInt).toBe(false)
	})

	it('returns undefined for unknown feedbackType', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 1 })
		const result = await learnParameterFeedbackOptions(state, 'unknown' as any)(makeFeedback('0.1'), ctx)
		expect(result).toBeUndefined()
	})

	it('does not mutate the original feedback.options object', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const feedback = makeFeedback('0.1', { parseEscapeChars: false, value: 'original' })
		const originalOptions = feedback.options
		await learnParameterFeedbackOptions(state, FeedbackId.String)(feedback, ctx)
		expect(feedback.options).toBe(originalOptions)
		expect(feedback.options.value).toBe('original')
	})
})

// ---------------------------------------------------------------------------
// resolveBooleanFeedback
// ---------------------------------------------------------------------------

describe('resolveBooleanFeedback', () => {
	beforeEach(() => {
		vi.mocked(compareNumber).mockClear()
		vi.mocked(compareNumber).mockReturnValue(true)
	})

	it('Boolean: returns true when parameter value is truthy', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: true })
		const result = await resolveBooleanFeedback(state, 'boolean' as any, '0.1')
		expect(result).toBe(true)
	})

	it('Boolean: returns false when parameter value is falsy', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: false })
		const result = await resolveBooleanFeedback(state, 'boolean' as any, '0.1')
		expect(result).toBe(false)
	})

	it('Real: delegates to compareNumber', async () => {
		vi.mocked(compareNumber).mockReturnValue(false)
		const state = makeState()
		state.parameters.set('0.1', { value: 3.14 })
		const result = await resolveBooleanFeedback(state, 'real' as any, '0.1', 3.14)
		expect(compareNumber).toHaveBeenCalled()
		expect(result).toBe(false)
	})

	it('Integer: applies factor to the comparison value', async () => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: 500 })
		await resolveBooleanFeedback(state, 'integer' as any, '0.1', 5, {
			comparitor: 'eq' as any,
			factor: '100',
		})
		expect(vi.mocked(compareNumber).mock.calls[0][0]).toBe(500) // Math.floor(5 * 100)
	})

	it('Integer: treats NaN factor as 1', async () => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: 5 })
		await resolveBooleanFeedback(state, 'integer' as any, '0.1', 5, {
			comparitor: 'eq' as any,
			factor: 'not-a-number',
		})
		expect(vi.mocked(compareNumber).mock.calls[0][0]).toBe(5) // Math.floor(5 * 1)
	})

	it('Enum: returns true when current enum value matches', async () => {
		const state = makeState()
		state.getCurrentEnumValue.mockReturnValue('On')
		const result = await resolveBooleanFeedback(state, 'enum' as any, '0.1', 'On')
		expect(result).toBe(true)
	})

	it('Enum: returns false when current enum value does not match', async () => {
		const state = makeState()
		state.getCurrentEnumValue.mockReturnValue('Off')
		const result = await resolveBooleanFeedback(state, 'enum' as any, '0.1', 'On')
		expect(result).toBe(false)
	})

	it('String: compares parsed value against parameter string value', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const result = await resolveBooleanFeedback(state, 'string' as any, '0.1', 'hello', { parse: false })
		expect(result).toBe(true)
	})

	it('String: returns false when values do not match', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const result = await resolveBooleanFeedback(state, 'string' as any, '0.1', 'world', { parse: false })
		expect(result).toBe(false)
	})

	it('String: calls parseEscapeCharacters when parse is true', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		await resolveBooleanFeedback(state, 'string' as any, '0.1', 'hello', { parse: true })
		expect(parseEscapeCharacters).toHaveBeenCalled()
	})

	it('default: falls through to String comparison', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'test' })
		const result = await resolveBooleanFeedback(state, 'unknown' as any, '0.1', 'test', { parse: false })
		expect(result).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// parameterFeedbackCallback
// ---------------------------------------------------------------------------

describe('parameterFeedbackCallback', () => {
	it('calls registerNewParameter on every invocation', async () => {
		const state = makeState()
		const self = makeSelf()
		const fn = parameterFeedbackCallback(self, state, FeedbackId.Boolean)
		await fn(makeFeedback('0.1'), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', true)
	})

	it('returns false when path is not in state.parameters', async () => {
		const state = makeState()
		const self = makeSelf()
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Boolean)(makeFeedback('0.1'), ctx)
		expect(result).toBe(false)
	})

	it('does not call registerNewParameter a second time in the else branch', async () => {
		const state = makeState()
		const self = makeSelf({ registerNewParameter: vi.fn().mockResolvedValue(false) })
		await parameterFeedbackCallback(self, state, FeedbackId.Boolean)(makeFeedback('0.1'), ctx)
		expect(self.registerNewParameter.mock.calls.length).toBe(1)
	})

	it('Boolean: resolves feedback when parameter exists', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: true })
		const self = makeSelf()
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Boolean)(makeFeedback('0.1'), ctx)
		expect(typeof result).toBe('boolean')
	})

	it('ENUM: passes enum value string from options', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 1 })
		state.getCurrentEnumValue.mockReturnValue('On')
		const self = makeSelf()
		const feedback = makeFeedback('0.1', { value: 'On' })
		const result = await parameterFeedbackCallback(self, state, FeedbackId.ENUM)(feedback, ctx)
		expect(result).toBe(true)
	})

	it('Parameter: uses Integer type when asInt is true', async () => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: 5 })
		const self = makeSelf()
		const feedback = makeFeedback('0.1', {
			asInt: true,
			value: 5,
			valueVar: '5',
			useVar: false,
			comparitor: 'eq',
			factor: '1',
		})
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Parameter)(feedback, ctx)
		expect(result).toBe(true)
	})

	it('Parameter: uses Real type when asInt is false', async () => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: 3.14 })
		const self = makeSelf()
		const feedback = makeFeedback('0.1', {
			asInt: false,
			value: 3.14,
			useVar: false,
			comparitor: 'eq',
			factor: '1',
		})
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Parameter)(feedback, ctx)
		expect(result).toBe(true)
	})

	it('Parameter: uses valueVar when useVar is true', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 5 })
		const self = makeSelf()
		const feedback = makeFeedback('0.1', {
			asInt: true,
			value: 0,
			valueVar: '5',
			useVar: true,
			comparitor: 'eq',
			factor: '1',
		})
		await parameterFeedbackCallback(self, state, FeedbackId.Parameter)(feedback, ctx)
		expect(vi.mocked(compareNumber).mock.calls.at(-1)?.[0]).toBe(5) // Math.floor('5' * 1)
	})

	it('String: passes value and parse flag from options', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello' })
		const self = makeSelf()
		const feedback = makeFeedback('0.1', { value: 'hello', parseEscapeChars: false })
		const result = await parameterFeedbackCallback(self, state, FeedbackId.String)(feedback, ctx)
		expect(result).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// parameterValueFeedbackCallback
// ---------------------------------------------------------------------------

describe('parameterValueFeedbackCallback', () => {
	it('returns null when path is not in state.parameters', async () => {
		const state = makeState()
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(result).toBeNull()
	})

	it('returns the raw value for non-Integer types', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 'hello', parameterType: 'string' })
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(result).toBe('hello')
	})

	it('applies factor division for Integer type', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 500, parameterType: 'integer', factor: 100 })
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(result).toBe(5)
	})

	it('defaults factor to 1 when not set for Integer type', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 42, parameterType: 'integer' })
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(result).toBe(42)
	})

	it('converts Buffer values to an Array', async () => {
		const state = makeState()
		const buf = Buffer.from([1, 2, 3])
		state.parameters.set('0.1', { value: buf, parameterType: 'string' })
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(Array.isArray(result)).toBe(true)
		expect(result).toEqual([1, 2, 3])
	})

	it('returns null when parameter value is null', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: null, parameterType: 'string' })
		const self = makeSelf()
		const result = await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(result).toBeNull()
	})

	it('calls registerNewParameter with false (read-only)', async () => {
		const state = makeState()
		const self = makeSelf()
		await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(self.registerNewParameter).toHaveBeenCalledWith('0.1', false)
	})

	it('does not call registerNewParameter a second time in the else branch', async () => {
		const state = makeState()
		const self = makeSelf({ registerNewParameter: vi.fn().mockResolvedValue(false) })
		await parameterValueFeedbackCallback(self, state)(makeFeedback('0.1'), ctx)
		expect(self.registerNewParameter.mock.calls.length).toBe(1)
	})
})
