import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	unsubscribeParameterFeedback,
	learnParameterFeedbackOptions,
	resolveBooleanFeedback,
	parameterFeedbackCallback,
} from '../../feedbacks/parameter.js'
import { FeedbackId } from '../../feedback.js'
import { compareNumber, parseEscapeCharacters } from '../../util.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@phillipivan/emberplus-connection', () => ({
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

vi.mock('../../feedback', () => ({
	FeedbackId: {
		Boolean: 'boolean',
		Parameter: 'parameter',
		String: 'string',
		ENUM: 'enum',
	},
}))

vi.mock('../../util', () => ({
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

vi.mock('../../state', () => ({
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
		// Off is entry 0, On entry 1
		getEnumValue: vi.fn((_path: string, name: string) => ({ Off: 0, On: 1 })[name]),
		...overrides,
	}
}

function makeSelf(overrides: Record<string, any> = {}) {
	return {
		useParameterForFeedback: vi.fn().mockResolvedValue(false),
		releaseParameterFeedback: vi.fn(),
		...overrides,
	} as any
}

function makeFeedback(path = '0.1', options: Record<string, any> = {}) {
	return {
		id: 'fb1',
		options: { path, ...options },
	} as any
}

const ctx = { signal: new AbortController().signal } as any

// ---------------------------------------------------------------------------
// unsubscribeParameterFeedback
// ---------------------------------------------------------------------------

describe('unsubscribeParameterFeedback', () => {
	// The instance stops rechecking it, and ends the path's stream if nothing else reads it
	it('releases the feedback', async () => {
		const self = makeSelf()
		await unsubscribeParameterFeedback(self)(makeFeedback('0.1'), ctx)
		expect(self.releaseParameterFeedback).toHaveBeenCalledWith('fb1')
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

	it('Parameter: learns the device value, factor 1 and asInt for an Integer type', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 42, parameterType: 'integer', factor: 100 })
		const feedback = makeFeedback('0.1', { factor: 1, comparitor: 'eq' })
		const result = await learnParameterFeedbackOptions(state, FeedbackId.Parameter)(feedback, ctx)
		// Only what was learned, so the path and comparitor (and any expression in them) are kept. The device value with a
		// factor of 1: the feedback multiplies the value by its factor, so the parameter's factor was applied twice
		expect(result).toEqual({ value: 42, asInt: true, factor: 1 })
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
			factor: 100,
		})
		expect(vi.mocked(compareNumber).mock.calls[0][0]).toBe(500) // Math.floor(5 * 100)
	})

	it('Integer: treats NaN factor as 1', async () => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: 5 })
		await resolveBooleanFeedback(state, 'integer' as any, '0.1', 5, {
			comparitor: 'eq' as any,
			factor: Number.NaN,
		})
		expect(vi.mocked(compareNumber).mock.calls[0][0]).toBe(5) // Math.floor(5 * 1)
	})

	// Glow 2.50: a null value is none at present. Read as a number it was 0, so '<= 5' or '== 0' held
	it.each([['real'], ['integer']])('%s: a null value matches no comparison', async (type) => {
		vi.mocked(compareNumber).mockReturnValue(true)
		const state = makeState()
		state.parameters.set('0.1', { value: null })
		const result = await resolveBooleanFeedback(state, type as any, '0.1', 0, { comparitor: 'eq' as any, factor: 1 })
		expect(result).toBe(false)
	})

	it('Enum: returns true when the parameter is on the entry named', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 1 })
		const result = await resolveBooleanFeedback(state, 'enum' as any, '0.1', 'On')
		expect(result).toBe(true)
	})

	it('Enum: returns false when the parameter is on another entry, or the name is no entry', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 0 })
		expect(await resolveBooleanFeedback(state, 'enum' as any, '0.1', 'Unknown')).toBe(false)
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
	// API 2 has no feedback subscribe hook, so the callback registers the path, and the feedback against it, each time
	it('uses the path for the feedback on every invocation', async () => {
		const state = makeState()
		const self = makeSelf()
		const fn = parameterFeedbackCallback(self, state, FeedbackId.Boolean)
		await fn(makeFeedback('0.1'), ctx)
		await fn(makeFeedback('0.1'), ctx)
		expect(self.useParameterForFeedback).toHaveBeenCalledTimes(2)
		// with the check's abort signal, so a superseded check doesn't wait in the queue
		expect(self.useParameterForFeedback).toHaveBeenCalledWith('fb1', '0.1', ctx.signal)
	})

	it('returns false when path is not in state.parameters', async () => {
		const state = makeState()
		const self = makeSelf()
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Boolean)(makeFeedback('0.1'), ctx)
		expect(result).toBe(false)
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
			comparitor: 'eq',
			factor: 1,
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
			comparitor: 'eq',
			factor: 1,
		})
		const result = await parameterFeedbackCallback(self, state, FeedbackId.Parameter)(feedback, ctx)
		expect(result).toBe(true)
	})

	it('Parameter: applies the factor option to an Integer comparison', async () => {
		const state = makeState()
		state.parameters.set('0.1', { value: 500 })
		const self = makeSelf()
		const feedback = makeFeedback('0.1', { asInt: true, value: 5, comparitor: 'eq', factor: 100 })
		await parameterFeedbackCallback(self, state, FeedbackId.Parameter)(feedback, ctx)
		expect(vi.mocked(compareNumber).mock.calls.at(-1)?.[0]).toBe(500) // Math.floor(5 * 100)
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
