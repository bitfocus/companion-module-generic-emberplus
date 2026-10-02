import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmberPlusInstance } from './index.js'
import { EmberPlusState } from './state.js'
import * as util from './util.js'
import { parseBonjourHost } from './util.js'
import { ElementType, ParameterType } from 'emberplus-connection/dist/model/index.js'
import { LoggerLevel } from './logger.js'
import { GetVariablesList } from './variables.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@companion-module/base', () => ({
	InstanceBase: class {
		checkFeedbacks = vi.fn()
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
	portDefault: 9000,
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
	isValidHostname: (host: string) =>
		/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/.test(
			host,
		),
	isValidPort: (port: number) => Number.isInteger(port) && port >= 1 && port <= 0xffff,
	nextReconnectDelay: vi.fn().mockReturnValue(5000),
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

	it('does not resend unchanged variable definitions', () => {
		const instance = makeInstance()
		const defs = [{ variableId: '0.1', name: '0.1' }]
		vi.mocked(GetVariablesList).mockReturnValue(defs)
		instance.updateCompanionBits()
		instance.updateCompanionBits()
		instance.updateCompanionBits()
		expect((instance as any).setVariableDefinitions).toHaveBeenCalledTimes(1)
		vi.mocked(GetVariablesList).mockReturnValue([])
	})

	it('resends variable definitions when they change', () => {
		const instance = makeInstance()
		vi.mocked(GetVariablesList).mockReturnValueOnce([{ variableId: '0.1', name: '0.1' }])
		instance.updateCompanionBits()
		vi.mocked(GetVariablesList).mockReturnValueOnce([{ variableId: '0.1', name: '0.1: Gain' }])
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
		expect((instance as any).checkFeedbacks).toHaveBeenCalledTimes(1)
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
		vi.mocked(GetVariablesList).mockReturnValue([{ variableId: '0.1', name: '0.1' }])

		for (let i = 0; i < 20; i++) {
			state.clearCache()
			await instance.registerNewParameter('0.1', true)
		}

		expect((instance as any).setVariableDefinitions).toHaveBeenCalledTimes(1)
		vi.mocked(GetVariablesList).mockReturnValue([])
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

	it('queues feedback check for registered feedback ids', async () => {
		const instance = makeInstance()
		;(instance as any).state.addIdToPathMap('fb1', '0.1')
		;(instance as any).throttledFeedbackChecksVariableUpdates = vi.fn()
		await instance.handleChangedValue('0.1', makeNode())
		expect((instance as any).feedbacksToCheck.has('fb1')).toBe(true)
	})

	it('calls recordParameterAction when recording is active', async () => {
		const { recordParameterAction } = await import('./util.js')
		const instance = makeInstance()
		;(instance as any).isRecordingActions = true
		await instance.handleChangedValue('0.1', makeNode())
		expect(recordParameterAction).toHaveBeenCalled()
	})

	it('does not call recordParameterAction when not recording', async () => {
		const { recordParameterAction } = await import('./util.js')
		vi.mocked(recordParameterAction).mockClear()
		const instance = makeInstance()
		;(instance as any).isRecordingActions = false
		await instance.handleChangedValue('0.1', makeNode())
		expect(vi.mocked(recordParameterAction).mock.calls.length).toBe(0)
	})

	it('skips processing when parseParameterValue returns no actionType', async () => {
		const util = await import('./util.js')
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
// setHost
// ---------------------------------------------------------------------------

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
// scheduleReconnect
// ---------------------------------------------------------------------------

describe('scheduleReconnect', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it('discards the client and keeps only one retry pending', () => {
		const instance = makeInstance()
		const discard = vi.fn()
		;(instance as any).emberClient = { removeAllListeners: vi.fn(), discard }
		;(instance as any).scheduleReconnect()
		;(instance as any).scheduleReconnect()
		expect(discard).toHaveBeenCalledTimes(1)
		expect((instance as any).emberClient).toBeUndefined()
		expect((instance as any).reconnectAttempts).toBe(1)
		expect(vi.getTimerCount()).toBe(1)
	})

	it('backs off using the number of consecutive attempts', () => {
		const instance = makeInstance()
		const setup = vi.spyOn(instance as any, 'setupEmberConnection').mockResolvedValue(undefined)
		;(instance as any).scheduleReconnect()
		vi.advanceTimersByTime(5000)
		expect(setup).toHaveBeenCalledTimes(1)
		;(instance as any).scheduleReconnect()
		expect(vi.mocked(util.nextReconnectDelay)).toHaveBeenLastCalledWith(2)
	})

	it('stops the library from retrying on a discarded client', () => {
		const instance = makeInstance()
		const s101: any = { _autoReconnect: true, _shouldBeConnected: true, _clearConnectionAttemptTimer: vi.fn() }
		;(instance as any).emberClient = { removeAllListeners: vi.fn(), discard: vi.fn(), _client: s101 }
		;(instance as any).scheduleReconnect()
		expect(s101._autoReconnect).toBe(false)
		expect(s101._shouldBeConnected).toBe(false)
		expect(s101._clearConnectionAttemptTimer).toHaveBeenCalled()
	})

	it('is cancelled by destroy', async () => {
		const instance = makeInstance()
		;(instance as any).scheduleReconnect()
		await instance.destroy()
		expect(vi.getTimerCount()).toBe(0)
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
