import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EmberPlusInstance from '../index.js'
import { EmberPlusState } from '../state.js'
import * as util from '../util.js'
import { hasConnectionChanged, parseBonjourHost } from '../util.js'
import { Model as EmberModel, setDebugLogging } from '@phillipivan/emberplus-connection'
import { captureLogs } from './logs.js'
import { GetActionsList } from '../actions.js'
import { GetVariablesList } from '../variables.js'
import { UpdateCompositeElements } from '../composites.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', async (importOriginal) => ({
	// The real module loggers, which captureLogs reads
	createModuleLogger: (await importOriginal<typeof import('@companion-module/base')>()).createModuleLogger,
	// The real host name pattern, which util's isValidHostname reads
	Regex: (await importOriginal<typeof import('@companion-module/base')>()).Regex,
	InstanceBase: class {
		checkFeedbacks = vi.fn()
		checkAllFeedbacks = vi.fn()
		checkFeedbacksById = vi.fn()
		subscribeActions = vi.fn()
		setActionDefinitions = vi.fn()
		setFeedbackDefinitions = vi.fn()
		setVariableDefinitions = vi.fn()
		setVariableValues = vi.fn()
		setPresetDefinitions = vi.fn()
		recordAction = vi.fn()
		saveConfig = vi.fn()
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
}))

// The real model (enums and guards); only the client, and the library's debug switch, are faked
vi.mock('@phillipivan/emberplus-connection', async (importOriginal) => ({
	...(await importOriginal<typeof import('@phillipivan/emberplus-connection')>()),
	EmberClient: class {
		on = vi.fn()
		connect = vi.fn().mockResolvedValue(undefined)
		disconnect = vi.fn().mockResolvedValue(undefined)
		discard = vi.fn()
		removeAllListeners = vi.fn()
		getDirectory = vi.fn().mockResolvedValue({ response: Promise.resolve() })
		getElementByPath = vi.fn().mockResolvedValue(undefined)
		tree = new Map()
	},
	setDebugLogging: vi.fn(),
}))

const { ElementType, ParameterType } = EmberModel

vi.mock('../actions', () => ({ GetActionsList: vi.fn().mockReturnValue({}) }))
vi.mock('../feedback', () => ({
	GetFeedbacksList: vi.fn().mockReturnValue({}),
	FeedbackId: {},
}))
vi.mock('../presets', () => ({ GetPresetsList: vi.fn().mockReturnValue({ structure: [], presets: {} }) }))
vi.mock('../composites', () => ({ UpdateCompositeElements: vi.fn() }))
// The real variable values and the choice of which parameters get them; only the definitions are faked
vi.mock('../variables', async (importOriginal) => ({
	...(await importOriginal<typeof import('../variables.js')>()),
	GetVariablesList: vi.fn().mockReturnValue({}),
}))
vi.mock('../config', () => ({
	GetConfigFields: vi.fn().mockReturnValue([]),
	portDefault: 9000,
	connectionVariablesDefault: ['parameterValues'],
}))
vi.mock('../upgrades', () => ({ UpgradeScripts: [] }))

vi.mock('../status.js', () => ({
	StatusManager: class {
		updateStatus = vi.fn()
		destroy = vi.fn()
	},
}))

// The real helpers, but for those the tests stub
vi.mock('../util', async (importOriginal) => ({
	...(await importOriginal<typeof import('../util.js')>()),
	parseBonjourHost: vi.fn().mockReturnValue(['192.168.0.1', 9000]),
	hasConnectionChanged: vi.fn().mockReturnValue(false),
	recordParameterAction: vi.fn(),
	parseParameterValue: vi.fn().mockReturnValue({ actionType: 'setValueInt', value: 42 }),
	discoverFunctionsFromTree: vi.fn(),
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
	const instance = new EmberPlusInstance('test-id')
	// Wire a fresh state
	;(instance as any).state = new EmberPlusState()
	// Provide a default config
	;(instance as any).config = {
		host: '192.168.0.1',
		port: 9000,
		factor: true,
		verbose: false,
		variables: ['parameterValues'],
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
		expect([...(instance as any).state.matrices.keys()]).toEqual(['0.1.0', '0.2.0', '0.3.0'])
	})

	it('converts slashes to dots', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = '0/1/0, 0/2/0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.has('0.1.0')).toBe(true)
	})

	it('filters out empty entries', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = '0.1.0,,  , 0.2.0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.size).toBe(2)
	})

	it('resets selected source and target when matrices exist', () => {
		const instance = makeInstance()
		;(instance as any).state.selected = { source: 5, target: 3, matrix: '0.1.0' }
		;(instance as any).config.matricesString = '0.1.0'
		;(instance as any).setupMatrices()
		expect((instance as any).state.selected).toEqual({ source: -1, target: -1, matrix: '' })
	})

	it('drops the variables of a matrix no longer configured', () => {
		const instance = makeInstance() as any
		instance.config.variables = ['matrixTargetNames']
		instance.config.matricesString = '1.4'
		instance.setupMatrices()
		const matrix = new EmberModel.MatrixImpl('router')
		matrix.targetCount = 1
		instance.state.matrices.get('1.4').node = new EmberModel.NumberedTreeNodeImpl(4, matrix)
		instance.matrixVariableDefinitions = undefined
		instance.updateVariableDefinitions()
		expect(Object.keys(instance.setVariableDefinitions.mock.lastCall[0])).toContain('matrix_1.4_target_0_name')
		instance.config.matricesString = ''
		instance.setupMatrices()
		instance.updateVariableDefinitions()
		expect(Object.keys(instance.setVariableDefinitions.mock.lastCall[0])).not.toContain('matrix_1.4_target_0_name')
	})

	it('does nothing when matricesString is undefined', () => {
		const instance = makeInstance()
		;(instance as any).config.matricesString = undefined
		;(instance as any).setupMatrices()
		expect((instance as any).state.matrices.size).toBe(0)
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

	it('drops runtime-registered paths when rebuilt, leaving re-registration to actions and feedbacks', () => {
		const instance = makeInstance()
		;(instance as any).config.monitoredParametersString = '0.1.2'
		;(instance as any).setupMonitoredParams()
		;(instance as any).state.monitoredParameters.add('0.9.9')
		;(instance as any).setupMonitoredParams()
		expect((instance as any).state.monitoredParameters).toEqual(new Set(['0.1.2']))
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
		expect((instance as any).setPresetDefinitions).toHaveBeenCalledWith([], {})
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

	it('does not resend unchanged variable definitions', () => {
		const instance = makeInstance()
		const defs = { '0.1': { name: '0.1' } }
		vi.mocked(GetVariablesList).mockReturnValue(defs)
		instance.updateCompanionBits()
		instance.updateCompanionBits()
		instance.updateCompanionBits()
		expect((instance as any).setVariableDefinitions).toHaveBeenCalledTimes(1)
		vi.mocked(GetVariablesList).mockReturnValue({})
	})

	it('resends variable definitions when they change', () => {
		const instance = makeInstance()
		vi.mocked(GetVariablesList).mockReturnValueOnce({ '0.1': { name: '0.1' } })
		instance.updateCompanionBits()
		vi.mocked(GetVariablesList).mockReturnValueOnce({ '0.1': { name: '0.1: Gain' } })
		instance.updateCompanionBits()
		expect((instance as any).setVariableDefinitions).toHaveBeenCalledTimes(2)
	})
})

// ---------------------------------------------------------------------------
// finalizeSetup
// ---------------------------------------------------------------------------

describe('finalizeSetup', () => {
	it('re-subscribes actions after definitions are set, so action paths are re-registered on reconnect', async () => {
		const instance = makeInstance()
		await (instance as any).finalizeSetup()

		const subscribeActions = (instance as any).subscribeActions
		const setActionDefinitions = (instance as any).setActionDefinitions
		expect(subscribeActions).toHaveBeenCalledTimes(1)
		expect(subscribeActions).toHaveBeenCalledWith()
		expect(subscribeActions.mock.invocationCallOrder[0]).toBeGreaterThan(
			setActionDefinitions.mock.invocationCallOrder[0],
		)
		expect((instance as any).checkAllFeedbacks).toHaveBeenCalledTimes(1)
	})
})

// ---------------------------------------------------------------------------
// registerNewParameter
// ---------------------------------------------------------------------------

describe('registerNewParameter', () => {
	it('sends variable definitions once when an already-monitored path re-registers after a cache clear', async () => {
		// Log from issue #79: after a reconnect every feedback on an already-monitored path
		// re-registered and each one pushed an identical "Updating variable definitions (11 variables)".
		const instance = makeInstance()
		const state: EmberPlusState = (instance as any).state
		const node = { contents: { type: ElementType.Parameter, parameterType: ParameterType.Integer, value: 1 } }
		;(instance as any).emberClient = { getElementByPath: vi.fn().mockResolvedValue(node) }
		vi.mocked(GetVariablesList).mockReturnValue({ '0.1': { name: '0.1' } })

		for (let i = 0; i < 20; i++) {
			state.clearCache()
			await instance.registerNewParameter('0.1')
		}

		expect((instance as any).setVariableDefinitions).toHaveBeenCalledTimes(1)
		vi.mocked(GetVariablesList).mockReturnValue({})
	})
})

// ---------------------------------------------------------------------------
// registerParameters
// ---------------------------------------------------------------------------

describe('connection variables', () => {
	it('defines parameter variables with parameter values on', () => {
		const instance = makeInstance()
		instance.updateCompanionBits({ updateVariables: true })
		expect(vi.mocked(GetVariablesList)).toHaveBeenLastCalledWith(expect.anything(), { values: true, streams: false })
	})

	it('defines none with parameter values off', () => {
		const instance = makeInstance()
		;(instance as any).config.variables = ['matrixConnections']
		instance.updateCompanionBits({ updateVariables: true })
		expect(vi.mocked(GetVariablesList)).toHaveBeenLastCalledWith(expect.anything(), { values: false, streams: false })
	})

	it('defines stream variables with parameter streams on', () => {
		const instance = makeInstance()
		;(instance as any).config.variables = ['parameterStreams']
		instance.updateCompanionBits({ updateVariables: true })
		expect(vi.mocked(GetVariablesList)).toHaveBeenLastCalledWith(expect.anything(), { values: false, streams: true })
	})

	// The actions' Auto Create Variable checkbox is gone: every parameter an action or feedback uses is monitored, so
	// it gets variables whenever parameter values are on. The value feedback's did not before
	it('monitors every parameter an action or feedback registers', async () => {
		const instance = makeInstance()
		const node = { number: 2, contents: { type: ElementType.Parameter, parameterType: ParameterType.Real, value: 1 } }
		;(instance as any).emberClient = { getElementByPath: vi.fn().mockResolvedValue(node) }
		await instance.registerNewParameter('1.2')
		expect((instance as any).state.monitoredParameters.has('1.2')).toBe(true)
	})

	it('does not monitor a function it registers', async () => {
		const instance = makeInstance()
		const node = { number: 2, contents: { type: ElementType.Function } }
		;(instance as any).emberClient = { getElementByPath: vi.fn().mockResolvedValue(node) }
		await instance.registerNewParameter('1.2')
		expect((instance as any).state.monitoredParameters.has('1.2')).toBe(false)
	})
})

describe('registerParameters', () => {
	// p-queue 10 rejects the tasks a clear() drops, where 9 left them pending. A reconnect or config change
	// clears the queue while this loop awaits a registration; it used to resume and register the remaining
	// paths of the old config against whichever client was current by then.
	it('stops once the client it started with has been replaced', async () => {
		const instance = makeInstance()
		const state: EmberPlusState = (instance as any).state
		state.monitoredParameters = new Set(['1.1', '1.2', '1.3'])
		const next = { getElementByPath: vi.fn().mockResolvedValue(undefined) }
		const first = {
			getElementByPath: vi.fn().mockImplementation(async () => {
				;(instance as any).emberClient = next
				throw new DOMException('The queue was cleared', 'AbortError')
			}),
		}
		;(instance as any).emberClient = first

		await (instance as any).registerParameters()

		expect(first.getElementByPath).toHaveBeenCalledTimes(1)
		expect(next.getElementByPath).not.toHaveBeenCalled()
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
		await instance.handleChangedValue('0.1', { contents: { type: ElementType.Node } })
		expect((instance as any).setVariableValues.mock.calls.length).toBe(0)
	})

	// A parameter's presets follow its access, range and online state; a stream's values mustn't rebuild them each time
	it('builds the presets again for a report changing what they are built from, not for a value', async () => {
		const instance = makeInstance() as any
		await instance.handleChangedValue('0.1', makeNode({ access: EmberModel.ParameterAccess.ReadWrite }))
		instance.setPresetDefinitions.mockClear()
		await instance.handleChangedValue('0.1', makeNode({ access: EmberModel.ParameterAccess.ReadWrite, value: 11 }))
		expect(instance.setPresetDefinitions).not.toHaveBeenCalled()
		await instance.handleChangedValue('0.1', makeNode({ access: EmberModel.ParameterAccess.Read, value: 11 }))
		expect(instance.setPresetDefinitions).toHaveBeenCalledTimes(1)
	})

	// A meter's name and range are rechecked on every stream value otherwise
	it('rechecks a feedback not reading the value only when more than the value changes', async () => {
		const instance = makeInstance() as any
		instance.throttledFeedbackChecksVariableUpdates = vi.fn()
		await instance.handleChangedValue('0.1', makeNode({ value: 1, minimum: 0 }))
		instance.state.addIdToPathMap('level', '0.1')
		instance.state.addIdToPathMap('name', '0.1', false)
		instance.feedbacksToCheck.clear()
		await instance.handleChangedValue('0.1', makeNode({ value: 2, minimum: 0 }))
		expect([...instance.feedbacksToCheck]).toEqual(['level'])
		instance.feedbacksToCheck.clear()
		await instance.handleChangedValue('0.1', makeNode({ value: 2, minimum: -10 }))
		expect([...instance.feedbacksToCheck].sort()).toEqual(['level', 'name'])
	})

	it('queues feedback check for registered feedback ids', async () => {
		const instance = makeInstance()
		;(instance as any).state.addIdToPathMap('fb1', '0.1')
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).feedbacksToCheck.has('fb1')).toBe(true)
	})

	it('calls recordParameterAction when recording is active', async () => {
		const { recordParameterAction } = await import('../util.js')
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		await instance.handleChangedValue('0.1', makeNode())
		expect(recordParameterAction).toHaveBeenCalled()
	})

	it('does not record a null value, which no action can set', async () => {
		const util = await import('../util.js')
		vi.mocked(util.recordParameterAction).mockClear()
		vi.mocked(util.parseParameterValue).mockReturnValueOnce({ actionType: 'setValueInt' as any, value: null })
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		await instance.handleChangedValue('0.1', makeNode({ value: null }))
		expect(util.recordParameterAction).not.toHaveBeenCalled()
	})

	it('does not call recordParameterAction when not recording', async () => {
		const { recordParameterAction } = await import('../util.js')
		vi.mocked(recordParameterAction).mockClear()
		const instance = makeInstance()
		;(instance as any).isRecordingActions = false
		await instance.handleChangedValue('0.1', makeNode())
		expect(vi.mocked(recordParameterAction).mock.calls.length).toBe(0)
	})

	// An octet string has no Set Value action, but Parameter Property reads it, and it can have a variable
	it('rechecks feedbacks and sets variables for a parameter of a type with no action, recording nothing', async () => {
		const util = await import('../util.js')
		vi.mocked(util.recordParameterAction).mockClear()
		vi.mocked(util.parseParameterValue).mockReturnValueOnce({ actionType: undefined, value: null })
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).state.addIdToPathMap('fb1', '0.1')
		await instance.handleChangedValue(
			'0.1',
			makeNode({ parameterType: ParameterType.Octets, value: Buffer.from([1, 2]) }),
		)
		expect((instance as any).feedbacksToCheck.has('fb1')).toBe(true)
		expect((instance as any).variableValueUpdates['0.1']).toEqual([1, 2])
		expect(util.recordParameterAction).not.toHaveBeenCalled()
	})

	// Meter values arrive many times a second
	it('does not record a stream parameter', async () => {
		const util = await import('../util.js')
		vi.mocked(util.recordParameterAction).mockClear()
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		await instance.handleChangedValue('0.1', makeNode({ streamIdentifier: 3 }))
		expect(util.recordParameterAction).not.toHaveBeenCalled()
	})

	it('logs each value only with Verbose Logs', async () => {
		const instance = makeInstance()
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).log).not.toHaveBeenCalledWith('debug', expect.stringContaining('Got parameter value'))
		;(instance as any).config.verbose = true
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).log).toHaveBeenCalledWith('debug', 'Got parameter value for 0.1: 10')
	})
})

// ---------------------------------------------------------------------------
// updateFeedbacksAndVariables
// ---------------------------------------------------------------------------

describe('updateFeedbacksAndVariables', () => {
	function update(instance: EmberPlusInstance, path: string, contents: Record<string, unknown>) {
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		;(instance as any).updateFeedbacksAndVariables(path, { type: ElementType.Parameter, ...contents })
		return (instance as any).variableValueUpdates
	}

	// Apply Formula and Factor to Parameter Variables: the library's displayValue
	it('stores an integer divided by its factor, with the option on', () => {
		const instance = makeInstance()
		;(instance as any).config.factor = true
		expect(update(instance, '0.1', { parameterType: ParameterType.Integer, value: 10, factor: 2 })['0.1']).toBe(5)
	})

	it('stores a value by its formula, with the option on', () => {
		const instance = makeInstance()
		;(instance as any).config.factor = true
		const contents = { parameterType: ParameterType.Real, value: 2, formula: '$ * 10\n$ / 10' }
		expect(update(instance, '0.1', contents)['0.1']).toBe(20)
	})

	it('stores the device value with the option off', () => {
		const instance = makeInstance()
		;(instance as any).config.factor = false
		expect(update(instance, '0.1', { parameterType: ParameterType.Integer, value: 10, factor: 2 })['0.1']).toBe(10)
	})

	// Glow 2.50: a null value is none at present
	it('stores a null value as null', () => {
		const instance = makeInstance()
		expect(update(instance, '0.1', { parameterType: ParameterType.Integer, value: null })['0.1']).toBeNull()
	})

	// Without Parameter - Values in Connection Variables there are no parameter variables, but feedbacks still update
	it('sets no variables with parameter values off, and still rechecks the feedbacks', () => {
		const instance = makeInstance()
		;(instance as any).config.variables = []
		;(instance as any).state.addIdToPathMap('fb1', '0.1')
		expect(update(instance, '0.1', { parameterType: ParameterType.Integer, value: 5 })).toEqual({})
		expect((instance as any).feedbacksToCheck.has('fb1')).toBe(true)
	})

	// A stream parameter gets variables with Parameter - Streams, the others with Parameter - Values
	it.each([
		[['parameterValues'], false],
		[['parameterStreams'], true],
	])('with %j, sets a stream parameter variable: %j', (variables, expected) => {
		const instance = makeInstance()
		;(instance as any).config.variables = variables
		const updates = update(instance, '0.1', { parameterType: ParameterType.Integer, value: 5, streamIdentifier: 1 })
		expect('0.1' in updates).toBe(expected)
	})

	it('stores _ENUM variable for Enum type', () => {
		const instance = makeInstance()
		const contents = { parameterType: ParameterType.Enum, enumeration: 'Off\nOn', value: 1 }
		;(instance as any).state.updateParameterMap('0.1', {
			contents: { type: ElementType.Parameter, ...contents },
		} as any)
		expect(update(instance, '0.1', contents)['0.1_ENUM']).toBe('On')
	})

	it('sanitises path to create variable id', () => {
		const instance = makeInstance()
		expect(update(instance, '0/1/2', { parameterType: ParameterType.Integer, value: 5 })['0_1_2']).toBe(5)
	})
})

// ---------------------------------------------------------------------------
// setHost
// ---------------------------------------------------------------------------

describe('a config change with another host', () => {
	// The dropdowns list the matrices the config names while connecting, and for good if the new host can't be reached
	it('sets the matrices the config now names before connecting', async () => {
		const instance = makeInstance() as any
		instance.config.matricesString = '1.4'
		instance.setupMatrices()
		vi.mocked(hasConnectionChanged).mockReturnValueOnce(true)
		await instance.configUpdated({ ...instance.config, host: '10.0.0.9', matricesString: '1.5, 1.6' })
		expect([...instance.state.matrices.keys()]).toEqual(['1.5', '1.6'])
		expect(vi.mocked(GetActionsList).mock.lastCall?.[3].matrices.has('1.5')).toBe(true)
		await instance.destroy()
	})
})

describe('setHost', () => {
	function makeHostInstance(): EmberPlusInstance {
		const instance = makeInstance()
		;(instance as any).config.bonjourHost = 'device._ember._tcp.local:9000'
		// applyConfig rewrites host and port from the bonjour parser, so it must reflect the config it is given
		vi.mocked(parseBonjourHost).mockImplementation((config: any) => [config.host ?? '', config.port ?? 9000])
		return instance
	}

	it('saves the new host and clears any bonjour device', async () => {
		const instance = makeHostInstance()
		await instance.setHost('10.0.0.5')
		expect((instance as any).saveConfig).toHaveBeenCalledWith(
			expect.objectContaining({ host: '10.0.0.5', port: 9000, bonjourHost: undefined }),
		)
	})

	it('saves a new port, keeping the configured host', async () => {
		const instance = makeHostInstance()
		await instance.setHost(undefined, 9001)
		expect((instance as any).saveConfig).toHaveBeenCalledWith(
			expect.objectContaining({ host: '192.168.0.1', port: 9001 }),
		)
	})

	it('saves host and port together', async () => {
		const instance = makeHostInstance()
		await instance.setHost('10.0.0.5', 9001)
		expect((instance as any).saveConfig).toHaveBeenCalledWith(expect.objectContaining({ host: '10.0.0.5', port: 9001 }))
	})

	it('throws and saves nothing for an implausible hostname', async () => {
		const instance = makeHostInstance()
		await expect(instance.setHost('not a host!')).rejects.toThrow('Set Host: Invalid hostname: not a host!')
		expect((instance as any).saveConfig.mock.calls.length).toBe(0)
	})

	it('throws and saves nothing for a port outside the valid range', async () => {
		const instance = makeHostInstance()
		await expect(instance.setHost('10.0.0.5', 70000)).rejects.toThrow('Set Host: Invalid port: 70000')
		expect((instance as any).saveConfig.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// The connection's life: the library reconnects a client, the module sets it up once
// ---------------------------------------------------------------------------

function fakeClient(overrides: Record<string, any> = {}) {
	return {
		connected: false,
		tree: new Map(),
		removeAllListeners: vi.fn(),
		discard: vi.fn(),
		getDirectory: vi.fn().mockResolvedValue({ response: Promise.resolve() }),
		getElementByPath: vi.fn().mockResolvedValue({ number: 1, contents: { type: ElementType.Node } }),
		...overrides,
	}
}

describe('connection', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	// Library 0.5.0 retries a dropped connection itself and restores its subscriptions. Rebuilding the client
	// threw that away, with the tree and every callback
	it('keeps the client when the connection drops, and schedules no rebuild', () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		;(instance as any).handleDisconnected(client)
		expect(client.discard).not.toHaveBeenCalled()
		expect((instance as any).emberClient).toBe(client)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('keeps the client on a connection error, and schedules no rebuild', () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		;(instance as any).handleConnectionError(client, new Error('ECONNREFUSED'))
		expect(client.discard).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('ignores the events of a client it has replaced', () => {
		const instance = makeInstance()
		const old = fakeClient()
		;(instance as any).emberClient = fakeClient()
		const finalize = vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		;(instance as any).handleConnected(old)
		;(instance as any).handleDisconnected(old)
		expect(finalize).not.toHaveBeenCalled()
		expect((instance as any).statusManager.updateStatus).not.toHaveBeenCalled()
	})

	it('loads the tree and sets up on the first connection of a client', async () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		const finalize = vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(client.getDirectory).toHaveBeenCalledTimes(1)
		expect(finalize).toHaveBeenCalledTimes(1)
		expect((instance as any).statusManager.updateStatus).toHaveBeenLastCalledWith('ok')
	})

	// The library has sent its GetDirectories and Subscribes again, keeping the tree and callbacks. Setting up again
	// registered another callback per path, which 0.5.0 calls alongside the first
	it('does not set up again when the library reconnects the same client', async () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		const finalize = vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(client.getDirectory).toHaveBeenCalledTimes(1)
		expect(finalize).toHaveBeenCalledTimes(1)
		expect((instance as any).statusManager.updateStatus).toHaveBeenLastCalledWith('ok')
	})

	// The library sends again only what reached the provider: a lookup that failed, or a Subscribe made, while the
	// connection was down, stayed undone until a config save
	it('registers every path in use again when the library reconnects the same client, without setting up again', async () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		const finalize = vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		const registerParameters = vi.spyOn(instance as any, 'registerParameters').mockResolvedValue(undefined)
		const sync = vi.spyOn(instance as any, 'debouncedStreamSync')
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		;(instance as any).subscribeActions.mockClear()
		;(instance as any).checkAllFeedbacks.mockClear()

		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(finalize).toHaveBeenCalledTimes(1)
		expect(registerParameters).toHaveBeenCalledTimes(1)
		expect((instance as any).subscribeActions).toHaveBeenCalledTimes(1)
		expect((instance as any).checkAllFeedbacks).toHaveBeenCalledTimes(1)
		expect(sync).toHaveBeenCalled()
	})

	// Labels are read on connecting: a reconnect reads them again, as they may have changed meanwhile
	it('loads the matrices again when the library reconnects the same client', async () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		vi.spyOn(instance as any, 'registerParameters').mockResolvedValue(undefined)
		const load = vi.spyOn(instance as any, 'loadMatrices').mockResolvedValue(undefined)
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(load).toHaveBeenCalledTimes(1)
	})

	it('loads the top level on a reconnect when the first connection could not', async () => {
		const instance = makeInstance()
		const client = fakeClient({ getDirectory: vi.fn().mockRejectedValueOnce(new Error('Socket was disconnected')) })
		;(instance as any).emberClient = client
		vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		vi.spyOn(instance as any, 'registerParameters').mockResolvedValue(undefined)
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		client.getDirectory.mockResolvedValue({ response: Promise.resolve() })
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(client.getDirectory).toHaveBeenCalledTimes(2)
		expect((instance as any).treeLoaded).toBe(true)
	})

	// The library loads the top level itself for a path it doesn't have, so the paths can still be registered. The
	// module used to discard the client and build another
	it('still sets up, keeping the client, when the top level cannot be loaded', async () => {
		const instance = makeInstance()
		const client = fakeClient({ getDirectory: vi.fn().mockRejectedValue(new Error('Request timed out')) })
		;(instance as any).emberClient = client
		const finalize = vi.spyOn(instance as any, 'finalizeSetup').mockResolvedValue(undefined)
		;(instance as any).handleConnected(client)
		await vi.runAllTimersAsync()
		expect(client.discard).not.toHaveBeenCalled()
		expect(finalize).toHaveBeenCalledTimes(1)
		expect((instance as any).statusManager.updateStatus).toHaveBeenLastCalledWith(
			'unknown_warning',
			'Request timed out',
		)
	})
})

// A Set Host to another provider replaces the client. Every path in use must be registered with the new provider:
// an element from the old one left in the cache was returned in place of registering the path
describe('set host to another provider', () => {
	function deferred<T>() {
		let resolve!: (value: T) => void
		const promise = new Promise<T>((r) => (resolve = r))
		return { promise, resolve }
	}
	const parameter = (value: number) => ({
		number: 2,
		contents: { type: ElementType.Parameter, parameterType: ParameterType.Integer, value },
	})

	it('caches nothing an old client finds after the change, and registers the path on the new one', async () => {
		const instance = makeInstance()
		const lookup = deferred<unknown>()
		const old = fakeClient({ getElementByPath: vi.fn().mockReturnValue(lookup.promise) })
		;(instance as any).emberClient = old

		// A lookup on the old provider, under way when the host changes
		const registering = instance.registerNewParameter('1.2')
		vi.mocked(util.hasConnectionChanged).mockReturnValueOnce(true)
		await instance.setHost('10.0.0.2')
		const next = (instance as any).emberClient
		expect(next).not.toBe(old)
		expect(old.discard).toHaveBeenCalled()

		lookup.resolve(parameter(1))
		expect(await registering).toBeUndefined()
		expect((instance as any).state.emberElement.has('1.2')).toBe(false)

		next.getElementByPath = vi.fn().mockResolvedValue(parameter(5))
		await instance.registerNewParameter('1.2')
		expect(next.getElementByPath).toHaveBeenCalledWith('1.2', expect.any(Function))
		expect((instance as any).state.parameters.get('1.2')?.value).toBe(5)
	})

	// The variables say where the module is connecting, reachable or not; they were set only once connected
	it('sets the host and port variables when it builds the client, before it connects', async () => {
		const instance = makeInstance()
		;(instance as any).config = { ...(instance as any).config, host: '10.0.0.9', port: 9001 }
		await (instance as any).setupEmberConnection()
		expect((instance as any).setVariableValues).toHaveBeenCalledWith({ host: '10.0.0.9', port: 9001 })
	})

	// The action callbacks hold the client they were defined with
	it('defines the actions again with the new client before it connects', async () => {
		const instance = makeInstance()
		;(instance as any).emberClient = fakeClient()
		vi.mocked(GetActionsList).mockClear()
		vi.mocked(util.hasConnectionChanged).mockReturnValueOnce(true)
		await instance.setHost('10.0.0.2')
		expect(vi.mocked(GetActionsList).mock.calls.at(-1)?.[1]).toBe((instance as any).emberClient)
	})
})

// A provider sends a stream parameter's values, many times a second, only to consumers that subscribed to it: subscribe
// while a feedback reads the parameter or it has a variable, and unsubscribe once neither holds
describe('stream subscriptions', () => {
	/** A parameter node, its element's numeric path as the fake client's getInternalNodePath gives it */
	function streamParameter(fields: Record<string, unknown> = {}, internalPath = '1.1') {
		return {
			internalPath,
			number: 1,
			parent: { number: 1 },
			contents: {
				type: ElementType.Parameter,
				parameterType: ParameterType.Integer,
				value: 0,
				streamIdentifier: 4,
				...fields,
			},
		}
	}

	function setup(node: ReturnType<typeof streamParameter> = streamParameter()) {
		const instance = makeInstance()
		const client = {
			subscribe: vi.fn().mockResolvedValue({ sentOk: true }),
			unsubscribe: vi.fn().mockResolvedValue({ sentOk: true }),
			getElementByPath: vi.fn().mockResolvedValue(node),
			getInternalNodePath: vi.fn((element: { internalPath?: string }) => element.internalPath),
			removeAllListeners: vi.fn(),
			discard: vi.fn(),
		}
		;(instance as any).emberClient = client
		return { instance, client, node }
	}

	it('subscribes to a stream parameter a feedback reads', async () => {
		const { instance, client, node } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		expect(client.subscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	it('subscribes once, for any number of feedbacks and checks', async () => {
		const { instance, client } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		await instance.useParameterForFeedback('fb1', '1.1')
		await instance.useParameterForFeedback('fb2', '1.1')
		expect(client.subscribe).toHaveBeenCalledTimes(1)
	})

	it('does not subscribe to a parameter that is no stream', async () => {
		const { instance, client } = setup(streamParameter({ streamIdentifier: undefined }))
		await instance.useParameterForFeedback('fb1', '1.1')
		expect(client.subscribe).not.toHaveBeenCalled()
	})

	// Actions read the value when they run
	it('does not subscribe for an action, without stream variables', async () => {
		const { instance, client } = setup()
		await instance.registerNewParameter('1.1')
		expect(client.subscribe).not.toHaveBeenCalled()
	})

	it('subscribes for a stream variable, with Parameter - Streams', async () => {
		const { instance, client } = setup()
		;(instance as any).config.variables = ['parameterStreams']
		await instance.registerNewParameter('1.1')
		expect(client.subscribe).toHaveBeenCalledTimes(1)
	})

	it('subscribes once a later report gives the stream identifier', async () => {
		const { instance, client, node } = setup(streamParameter({ streamIdentifier: undefined }))
		await instance.useParameterForFeedback('fb1', '1.1')
		node.contents.streamIdentifier = 4
		await instance.handleChangedValue('1.1', node as any)
		expect(client.subscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	it('keeps the stream while another feedback reads it, and unsubscribes after the last', async () => {
		const { instance, client, node } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		await instance.useParameterForFeedback('fb2', '1.1')
		instance.releaseParameterFeedback('fb1')
		expect(client.unsubscribe).not.toHaveBeenCalled()
		instance.releaseParameterFeedback('fb2')
		expect(client.unsubscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	// The library's unsubscribe drops every callback it holds for the path
	it('forgets the path after unsubscribing, and registers it afresh, callback and all, on its next use', async () => {
		const { instance, client } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		instance.releaseParameterFeedback('fb1')
		expect((instance as any).pathCallbacks.has('1.1')).toBe(false)
		expect((instance as any).state.emberElement.has('1.1')).toBe(false)

		client.getElementByPath.mockClear()
		await instance.useParameterForFeedback('fb2', '1.1')
		expect(client.getElementByPath).toHaveBeenCalledWith('1.1', expect.any(Function))
		expect(client.subscribe).toHaveBeenCalledTimes(2)
	})

	it('unsubscribes from the path a feedback is edited away from', async () => {
		const { instance, client, node } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		client.getElementByPath.mockResolvedValue(streamParameter({ streamIdentifier: undefined }, '1.2'))
		await instance.useParameterForFeedback('fb1', '1.2')
		expect(client.unsubscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	it('unsubscribes from the path of a feedback whose new path is not found', async () => {
		const { instance, client, node } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		client.getElementByPath.mockResolvedValue(undefined)
		await instance.useParameterForFeedback('fb1', '9.9')
		expect(client.unsubscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	// Turning Parameter - Streams off, or removing a configured path, leaves streams nothing uses
	it('ends the streams nothing uses once a config change has set up again', async () => {
		const { instance, client, node } = setup()
		;(instance as any).config.variables = ['parameterStreams']
		await instance.registerNewParameter('1.1')
		;(instance as any).config.variables = ['parameterValues']
		const sync = vi.spyOn(instance as any, 'debouncedStreamSync')
		await (instance as any).finalizeSetup()
		expect(sync).toHaveBeenCalled()
		expect(client.unsubscribe).toHaveBeenCalledExactlyOnceWith(node)
	})

	// The library holds one subscription for an element, whichever spelling subscribed, and its unsubscribe drops every
	// callback for the element: ending one spelling's stream silently ended the other's
	it('keeps the stream while another spelling of the element reads it, and forgets both after the last', async () => {
		const { instance, client, node } = setup()
		await instance.useParameterForFeedback('fbA', '1.1')
		await instance.useParameterForFeedback('fbB', 'device.meter')
		instance.releaseParameterFeedback('fbA')
		expect(client.unsubscribe).not.toHaveBeenCalled()
		expect((instance as any).pathCallbacks.has('device.meter')).toBe(true)

		instance.releaseParameterFeedback('fbB')
		expect(client.unsubscribe).toHaveBeenCalledExactlyOnceWith(node)
		for (const path of ['1.1', 'device.meter']) {
			expect((instance as any).pathCallbacks.has(path)).toBe(false)
			expect((instance as any).state.emberElement.has(path)).toBe(false)
		}
	})

	// The library sends again only the Subscribes that reached the provider
	it('does not hold a Subscribe that was not sent as subscribed, and subscribes again once synced', async () => {
		const { instance, client } = setup()
		client.subscribe.mockResolvedValueOnce({ sentOk: false })
		await instance.useParameterForFeedback('fb1', '1.1')
		await Promise.resolve()
		expect((instance as any).streamSubscriptions.has('1.1')).toBe(false)

		;(instance as any).debouncedStreamSync()
		expect(client.subscribe).toHaveBeenCalledTimes(2)
		expect((instance as any).streamSubscriptions.has('1.1')).toBe(true)
	})

	// Companion's unsubscribe can arrive while a check's registration waits in the queue (after a config save, say):
	// applying the check then put the removed feedback back, and kept its stream going for good
	it('drops a check whose feedback is released while it registers', async () => {
		const { instance, client, node } = setup()
		let found!: (value: unknown) => void
		client.getElementByPath.mockReturnValueOnce(new Promise((resolve) => (found = resolve)))
		const checking = instance.useParameterForFeedback('fb1', '1.1')
		instance.releaseParameterFeedback('fb1')
		found(node)
		await checking
		expect((instance as any).state.feedbackPath('fb1')).toBeUndefined()
		expect(client.subscribe).not.toHaveBeenCalled()
	})

	it('keeps the later of two checks of a feedback edited onto another path', async () => {
		const { instance, client, node } = setup()
		let found!: (value: unknown) => void
		client.getElementByPath.mockReturnValueOnce(new Promise((resolve) => (found = resolve)))
		const first = instance.useParameterForFeedback('fb1', '1.1')
		client.getElementByPath.mockResolvedValueOnce(streamParameter({ streamIdentifier: undefined }, '1.2'))
		await instance.useParameterForFeedback('fb1', '1.2')
		found(node)
		await first
		expect((instance as any).state.feedbackPath('fb1')).toBe('1.2')
	})

	// A check superseded by a fresh one is aborted: it stops, and Companion ignores the error
	it('passes the check signal to the queue, and stops once it aborts', async () => {
		const { instance } = setup()
		const controller = new AbortController()
		controller.abort()
		await expect(instance.useParameterForFeedback('fb1', '1.1', controller.signal)).rejects.toThrow()
		expect((instance as any).emberQueue.add).toHaveBeenCalledWith(expect.any(Function), { signal: controller.signal })
	})

	it('forgets its subscriptions with the client, whose library subscriptions go with it', async () => {
		const { instance } = setup()
		await instance.useParameterForFeedback('fb1', '1.1')
		;(instance as any).destroyEmberClient()
		expect((instance as any).streamSubscriptions.size).toBe(0)
	})
})

describe('getElementByPath', () => {
	// 0.5.0 calls every callback registered for an element. One per lookup ran handleChangedValue once more per change
	// after each config save, which clears the element cache and looks every path up again
	it('registers one callback per path on a client', async () => {
		const instance = makeInstance()
		const client = fakeClient()
		;(instance as any).emberClient = client
		await (instance as any).getElementByPath('1.2')
		await (instance as any).getElementByPath('1.2')
		await (instance as any).getElementByPath('device.gain')
		const callbacks = client.getElementByPath.mock.calls.map((call: unknown[]) => [call[0], typeof call[1]])
		expect(callbacks).toEqual([
			['1.2', 'function'],
			['1.2', 'undefined'],
			['device.gain', 'function'],
		])
	})

	it('registers again on a new client', async () => {
		const instance = makeInstance()
		const first = fakeClient()
		;(instance as any).emberClient = first
		await (instance as any).getElementByPath('1.2')
		;(instance as any).destroyEmberClient()
		const next = fakeClient()
		;(instance as any).emberClient = next
		await (instance as any).getElementByPath('1.2')
		expect(typeof next.getElementByPath.mock.calls[0][1]).toBe('function')
	})

	it('registers again when the path was not found', async () => {
		const instance = makeInstance()
		const client = fakeClient({ getElementByPath: vi.fn().mockResolvedValue(undefined) })
		;(instance as any).emberClient = client
		await (instance as any).getElementByPath('9.9')
		await (instance as any).getElementByPath('9.9')
		expect(typeof client.getElementByPath.mock.calls[1][1]).toBe('function')
	})
})

describe('loading matrices', () => {
	function matrixNode() {
		return new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router'))
	}

	function withMatrices(matricesString: string, client: ReturnType<typeof fakeClient>) {
		const instance = makeInstance()
		;(instance as any).config.matricesString = matricesString
		;(instance as any).emberClient = client
		return instance as any
	}

	it('drops a path the library finds no element at, or no matrix, with a warning', async () => {
		const client = fakeClient({
			getElementByPath: vi.fn(async (path: string) => {
				if (path === '1.5') throw new Error('Could not find node 5 on given path 1')
				if (path === '1.6') return { number: 6, contents: { type: ElementType.Parameter } }
				return matrixNode()
			}),
		})
		const instance = withMatrices('1.4, 1.5, 1.6', client)
		await instance.loadMatrices()
		expect([...instance.state.matrices.keys()]).toEqual(['1.4'])
		expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('Matrix 1.5 was not found'))
		expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('Matrix 1.6 is not a matrix'))
	})

	// Not shown not to be a matrix: the connection dropped, or the provider didn't answer in time
	it("keeps a matrix it couldn't look up just now, to look for again on reconnecting", async () => {
		const client = fakeClient({ getElementByPath: vi.fn().mockRejectedValue(new Error('Request timed out')) })
		const instance = withMatrices('1.4', client)
		await instance.loadMatrices()
		expect([...instance.state.matrices.keys()]).toEqual(['1.4'])
		expect(instance.log).toHaveBeenCalledWith('warn', expect.stringContaining('Matrix 1.4 could not be loaded'))
	})

	it('looks for a dropped matrix again on the next load', async () => {
		const client = fakeClient({
			getElementByPath: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue(matrixNode()),
		})
		const instance = withMatrices('1.4', client)
		await instance.loadMatrices()
		expect(instance.state.matrices.size).toBe(0)
		await instance.loadMatrices()
		expect(instance.state.matrices.get('1.4')?.node).toBeDefined()
	})

	it('asks for its targets, sources and connections with a GetDirectory on the matrix', async () => {
		const node = matrixNode()
		const client = fakeClient({ getElementByPath: vi.fn().mockResolvedValue(node) })
		const instance = withMatrices('1.4', client)
		await instance.loadMatrices()
		expect(client.getDirectory).toHaveBeenCalledWith(node)
		expect(instance.state.matrices.get('1.4').connectionsLoaded).toBe(true)
	})

	// Until the provider answers, the library's connections may hold only the targets a report covered
	it('counts its connections as loaded only once the provider has answered the GetDirectory on it', async () => {
		const node = matrixNode()
		const client = fakeClient({
			getElementByPath: vi.fn().mockResolvedValue(node),
			// Not sent: the connection is down
			getDirectory: vi.fn().mockResolvedValue({ sentOk: false }),
		})
		const instance = withMatrices('1.4', client)
		await instance.loadMatrices()
		expect(instance.state.matrices.get('1.4').connectionsLoaded).toBe(false)
		client.getDirectory.mockResolvedValue({ sentOk: true, response: Promise.reject(new Error('Request timed out')) })
		await instance.loadMatrices()
		expect(instance.state.matrices.get('1.4').connectionsLoaded).toBe(false)
	})

	// A path with a descriptor, as the actions' paths take, is looked up by its numbers
	it('looks a matrix up by the numbers of a path with a descriptor, following its changes', async () => {
		const node = matrixNode()
		const client = fakeClient({ getElementByPath: vi.fn().mockResolvedValue(node) })
		const instance = withMatrices('router[1.4]', client)
		instance.state.addMatrixFeedback('fb1', 'router[1.4]')
		await instance.loadMatrices()
		const [path, callback] = client.getElementByPath.mock.calls[0]
		expect(path).toBe('1.4')
		instance.checkFeedbacksById.mockClear()
		callback(node)
		await vi.waitFor(() => expect(instance.checkFeedbacksById).toHaveBeenCalledWith('fb1'))
	})
})

describe('composite elements', () => {
	// Nothing in them comes from the device, and a button saved with one needs its definition offline too
	it('are defined on init, before any connection', async () => {
		const instance = new EmberPlusInstance('test')
		await instance.init({ host: '10.0.0.1', port: 9000, factor: true, verbose: false, variables: [] })
		expect(UpdateCompositeElements).toHaveBeenCalledWith(instance)
		await instance.destroy()
	})
})

describe('library debug logging', () => {
	const logs = captureLogs()

	it('is on with Verbose Logs, and off without', () => {
		const instance = makeInstance()
		;(instance as any).applyConfig({ host: 'h', port: 9000, factor: true, verbose: true })
		expect(vi.mocked(setDebugLogging)).toHaveBeenLastCalledWith(true, expect.any(Function))
		;(instance as any).applyConfig({ host: 'h', port: 9000, factor: true, verbose: false })
		expect(vi.mocked(setDebugLogging)).toHaveBeenLastCalledWith(false, expect.any(Function))
	})

	it('goes to the ember plus module logger at debug level', () => {
		const instance = makeInstance()
		;(instance as any).applyConfig({ host: 'h', port: 9000, factor: true, verbose: true })
		const log = vi.mocked(setDebugLogging).mock.calls.at(-1)?.[1]
		log?.('emberplus-connection:client sent GetDirectory')
		expect(logs).toHaveBeenCalledWith('ember plus', 'debug', 'emberplus-connection:client sent GetDirectory')
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
