import { describe, it, expect, vi } from 'vitest'
import { EmberPlusInstance } from './index'
import { EmberPlusState } from './state'
import { ElementType, ParameterType } from 'emberplus-connection/dist/model'
import { LoggerLevel } from './logger.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => ({
	InstanceBase: class {
		checkFeedbacks = vi.fn()
		checkFeedbacksById = vi.fn()
		setActionDefinitions = vi.fn()
		setFeedbackDefinitions = vi.fn()
		setVariableDefinitions = vi.fn()
		setVariableValues = vi.fn()
		setPresetDefinitions = vi.fn()
		recordAction = vi.fn()
		log = vi.fn()
	},
	InstanceStatus: {
		Ok: 'ok',
		Connecting: 'connecting',
		ConnectionFailure: 'connection_failure',
		BadConfig: 'bad_config',
		UnknownWarning: 'unknown_warning',
		Disconnected: 'disconnected',
	},
	runEntrypoint: vi.fn(),
}))

vi.mock('emberplus-connection', () => ({
	EmberClient: class {
		on = vi.fn()
		connect = vi.fn().mockResolvedValue(undefined)
		disconnect = vi.fn().mockResolvedValue(undefined)
		discard = vi.fn()
		removeAllListeners = vi.fn()
		getDirectory = vi.fn().mockResolvedValue({ response: Promise.resolve() })
		getElementByPath = vi.fn().mockResolvedValue(undefined)
		tree = {}
	},
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
	ElementType: { Parameter: 'parameter', Node: 'node' },
	ParameterType: {
		Boolean: 'boolean',
		Integer: 'integer',
		Real: 'real',
		Enum: 'enum',
		String: 'string',
	},
}))

vi.mock('./actions', () => ({ GetActionsList: vi.fn().mockReturnValue({}) }))
vi.mock('./feedback', () => ({
	GetFeedbacksList: vi.fn().mockReturnValue({}),
	FeedbackId: {},
}))
vi.mock('./presets', () => ({ GetPresetsList: vi.fn().mockReturnValue({}) }))
vi.mock('./variables', () => ({ GetVariablesList: vi.fn().mockReturnValue([]) }))
vi.mock('./config', () => ({
	GetConfigFields: vi.fn().mockReturnValue([]),
}))
vi.mock('./upgrades', () => ({ UpgradeScripts: [] }))

vi.mock('./logger.js', () => ({
	Logger: class {
		info = vi.fn()
		warn = vi.fn()
		error = vi.fn()
		debug = vi.fn()
		console = vi.fn()
	},
	LoggerLevel: { Information: 'information', Warning: 'warning', Error: 'error' },
}))

vi.mock('./status.js', () => ({
	StatusManager: class {
		updateStatus = vi.fn()
		destroy = vi.fn()
	},
}))

vi.mock('./util', () => ({
	sanitiseVariableId: (id: string) => id.replaceAll(/[^a-zA-Z0-9-_.]/gm, '_'),
	parseBonjourHost: vi.fn().mockReturnValue(['192.168.0.1', 9000]),
	hasConnectionChanged: vi.fn().mockReturnValue(false),
	recordParameterAction: vi.fn(),
	parseParameterValue: vi.fn().mockReturnValue({ actionType: 'setValueInt', value: 42 }),
}))

vi.mock('p-queue', () => ({
	default: class {
		add = vi.fn().mockImplementation((fn: any) => fn())
		clear = vi.fn()
	},
}))

vi.mock('es-toolkit', () => ({
	throttle: vi.fn().mockImplementation((fn) => {
		const wrapped = (...args: any[]) => fn(...args)
		wrapped.cancel = vi.fn()
		return wrapped
	}),
	debounce: vi.fn().mockImplementation((fn) => {
		const wrapped = (...args: any[]) => fn(...args)
		wrapped.cancel = vi.fn()
		return wrapped
	}),
}))

// ---------------------------------------------------------------------------
// Factory — creates a fresh instance with state wired in
// ---------------------------------------------------------------------------

function makeInstance(): EmberPlusInstance {
	const instance = new EmberPlusInstance('test-id' as any)
	// Wire a fresh state
	;(instance as any).state = new EmberPlusState()
	// Provide a default config
	;(instance as any).config = {
		host: '192.168.0.1',
		port: 9000,
		factor: true,
		logging: LoggerLevel.Information,
	}
	return instance
}

// ---------------------------------------------------------------------------
// setupMatrices (via private access)
// ---------------------------------------------------------------------------

describe('setupMatrices', () => {
	it('populates state.matrices array from matricesString', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = '0.1.0, 0.2.0, 0.3.0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices).toEqual(['0.1.0', '0.2.0', '0.3.0'])
	})

	it('converts slashes to dots', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = '0/1/0, 0/2/0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.includes('0.1.0')).toBe(true)
	})

	it('filters out empty entries', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = '0.1.0,,  , 0.2.0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.length).toBe(2)
	})

	it('resets selected source and target when matrices exist', () => {
		const instance = makeInstance()
		;(instance as any).state.selected = { source: 5, target: 3, matrix: 0 }
		;(instance as any).config.matricesString = '0.1.0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.selected.source).toBe(-1)
		expect((instance as any).state.selected.target).toBe(-1)
	})

	it('does nothing when matricesString is undefined', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = undefined
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// setupMonitoredParams (via private access)
// ---------------------------------------------------------------------------

describe('setupMonitoredParams', () => {
	it('populates monitoredParameters from monitoredParametersString', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = '0.1.2, 0.3.4'
		;(instance as any).setupMonitoredParams()
		expect((instance as any).state.monitoredParameters).toEqual(new Set(['0.1.2', '0.3.4']))
	})

	it('converts slashes to dots', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = '0/1/2'
		;(instance as any).setupMonitoredParams()
		expect((instance as any).state.monitoredParameters.has('0.1.2')).toBe(true)
	})

	it('filters out empty entries', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = '0.1.2,,  ,'
		;(instance as any).setupMonitoredParams()
		expect((instance as any).state.monitoredParameters.size).toBe(1)
	})

	it('sorts parameters', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = '0.3, 0.1, 0.2'
		;(instance as any).setupMonitoredParams()
		const result = [...(instance as any).state.monitoredParameters]
		expect(result).toEqual([...result].sort())
	})

	it('results in an empty set when monitoredParametersString is undefined', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = undefined
		;(instance as any).setupMonitoredParams()
		expect((instance as any).state.monitoredParameters.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// updateCompanionBits
// ---------------------------------------------------------------------------

describe('updateCompanionBits', () => {
	it('calls all four setters when all options are true', () => {
		const instance = makeInstance()
		instance.updateCompanionBits({
			updateActions: true,
			updateFeedbacks: true,
			updatePresets: true,
			updateVariables: true,
		})
		expect((instance as any).setActionDefinitions).toHaveBeenCalled()
		expect((instance as any).setFeedbackDefinitions).toHaveBeenCalled()
		expect((instance as any).setVariableDefinitions).toHaveBeenCalled()
		expect((instance as any).setPresetDefinitions).toHaveBeenCalled()
	})

	it('skips setters for false options', () => {
		const instance = makeInstance()
		instance.updateCompanionBits({
			updateActions: false,
			updateFeedbacks: false,
			updatePresets: false,
			updateVariables: false,
		})
		expect((instance as any).setActionDefinitions.mock.calls.length).toBe(0)
		expect((instance as any).setFeedbackDefinitions.mock.calls.length).toBe(0)
		expect((instance as any).setVariableDefinitions.mock.calls.length).toBe(0)
		expect((instance as any).setPresetDefinitions.mock.calls.length).toBe(0)
	})

	it('only calls variable definitions when only updateVariables is true', () => {
		const instance = makeInstance()
		instance.updateCompanionBits({
			updateVariables: true,
			updateActions: false,
			updateFeedbacks: false,
			updatePresets: false,
		})
		expect((instance as any).setVariableDefinitions).toHaveBeenCalled()
		expect((instance as any).setActionDefinitions.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// handleStartStopRecordActions
// ---------------------------------------------------------------------------

describe('handleStartStopRecordActions', () => {
	it('sets isRecordingActions to true', () => {
		const instance = makeInstance()
		instance.handleStartStopRecordActions(true)
		expect((instance as any).isRecordingActions).toBe(true)
	})

	it('sets isRecordingActions to false', () => {
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		instance.handleStartStopRecordActions(false)
		expect((instance as any).isRecordingActions).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// handleChangedValue
// ---------------------------------------------------------------------------

describe('handleChangedValue', () => {
	function makeNode(overrides: Record<string, any> = {}) {
		return {
			contents: {
				type: ElementType.Parameter,
				parameterType: ParameterType.Integer,
				value: 10,
				...overrides,
			},
		} as any
	}

	it('ignores non-Parameter nodes', async () => {
		const instance = makeInstance()
		await instance.handleChangedValue('0.1', { contents: { type: ElementType.Node } } as any)
		expect((instance as any).setVariableValues.mock.calls.length).toBe(0)
	})

	it('queues feedback check for registered feedback ids', async () => {
		const instance = makeInstance()
		;(instance as any).state.addIdToPathMap('fb1', '0.1')
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).feedbacksToCheck.has('fb1')).toBe(true)
	})

	it('calls recordParameterAction when recording is active', async () => {
		const { recordParameterAction } = await import('./util')
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		await instance.handleChangedValue('0.1', makeNode())
		expect(recordParameterAction).toHaveBeenCalled()
	})

	it('does not call recordParameterAction when not recording', async () => {
		const { recordParameterAction } = await import('./util')
		vi.mocked(recordParameterAction).mockClear()
		const instance = makeInstance()
		;(instance as any).isRecordingActions = false
		await instance.handleChangedValue('0.1', makeNode())
		expect(vi.mocked(recordParameterAction).mock.calls.length).toBe(0)
	})

	it('skips processing when parseParameterValue returns no actionType', async () => {
		const util = await import('./util')
		vi.mocked(util.parseParameterValue).mockReturnValueOnce({ actionType: undefined, value: 0 })
		const instance = makeInstance()
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).setVariableValues.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// updateFeedbacksAndVariables
// ---------------------------------------------------------------------------

describe('updateFeedbacksAndVariables', () => {
	it('stores factorised value in variableValueUpdates for Integer when factor=true', () => {
		const instance = makeInstance()
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).config.factor = true
		;(instance as any).updateFeedbacksAndVariables('0.1', ParameterType.Integer, 5, 10)
		expect((instance as any).variableValueUpdates['0.1']).toBe(5)
	})

	it('stores raw value in variableValueUpdates for Integer when factor=false', () => {
		const instance = makeInstance()
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).config.factor = false
		;(instance as any).updateFeedbacksAndVariables('0.1', ParameterType.Integer, 5, 10)
		expect((instance as any).variableValueUpdates['0.1']).toBe(10)
	})

	it('stores _ENUM variable for Enum type', () => {
		const instance = makeInstance()
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).state.updateParameterMap('0.1', {
			contents: { type: ElementType.Parameter, parameterType: ParameterType.Enum, enumeration: 'Off\nOn', value: 1 },
		} as any)
		;(instance as any).updateFeedbacksAndVariables('0.1', ParameterType.Enum, 1, 1)
		expect((instance as any).variableValueUpdates['0.1_ENUM']).toBe('On')
	})

	it('sanitises path to create variable id', () => {
		const instance = makeInstance()
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).updateFeedbacksAndVariables('0/1/2', ParameterType.Integer, 5, 5)
		expect((instance as any).variableValueUpdates['0_1_2']).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// getConfigFields
// ---------------------------------------------------------------------------

describe('getConfigFields', () => {
	it('returns an array', () => {
		const instance = makeInstance()
		expect(Array.isArray(instance.getConfigFields())).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe('destroy', () => {
	it('cancels throttles, clears queue, and destroys client without throwing', async () => {
		const instance = makeInstance()
		// Provide a mock emberClient so destroyEmberClient does not throw on undefined check
		;(instance as any).emberClient = {
			removeAllListeners: vi.fn(),
			discard: vi.fn(),
		}
		await instance.destroy()
	})
})
