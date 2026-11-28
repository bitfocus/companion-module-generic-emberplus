import { describe, it, expect, vi, afterEach } from 'vitest'
import { createServer, type AddressInfo } from 'node:net'
import { EmberServer, Model as EmberModel } from '@phillipivan/emberplus-connection'
import EmberPlusInstance from '../index.js'
import type { EmberPlusConfig } from '../config.js'
import { captureLogs } from './logs.js'
import { StatusManager } from '../status.js'

// Discovery against the library's own provider, over TCP: the walk, what it lists, what gets variables, and changes
// followed through the 'change' event. Only Companion's side, InstanceBase, is faked.
vi.mock('@companion-module/base', async (importOriginal) => ({
	...(await importOriginal<typeof import('@companion-module/base')>()),
	InstanceBase: class {
		log = vi.fn()
		updateStatus = vi.fn()
		setActionDefinitions = vi.fn()
		setFeedbackDefinitions = vi.fn()
		setVariableDefinitions = vi.fn()
		setVariableValues = vi.fn()
		setPresetDefinitions = vi.fn()
		setCompositeElementDefinitions = vi.fn()
		checkFeedbacksById = vi.fn()
		checkAllFeedbacks = vi.fn()
		subscribeActions = vi.fn()
		recordAction = vi.fn()
		saveConfig = vi.fn()
	},
}))

const { ParameterType, ParameterAccess, NumberedTreeNodeImpl, EmberNodeImpl, ParameterImpl, childrenOf } = EmberModel

captureLogs()

async function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer()
		probe.on('error', reject)
		probe.listen(0, '127.0.0.1', () => {
			const { port } = probe.address() as AddressInfo
			probe.close(() => resolve(port))
		})
	})
}

/**
 * device (1): Inputs (1.1) with Ch1 (1.1.1: Gain 1.1.1.1, a read-write integer, and Meter 1.1.1.2, a stream) and Ch2
 * (1.1.2: Gain 1.1.2.1); Recall (1.2), a function; Router (1.3), a matrix; Outputs (1.4) with Level (1.4.1)
 */
function providerTree() {
	const gain = (number: number) => {
		const parameter = new ParameterImpl(ParameterType.Integer, 'Gain', undefined, 0)
		parameter.access = ParameterAccess.ReadWrite
		return new NumberedTreeNodeImpl(number, parameter)
	}
	const meterParameter = new ParameterImpl(ParameterType.Integer, 'Meter', undefined, 0)
	meterParameter.access = ParameterAccess.Read
	meterParameter.streamIdentifier = 7
	const ch1Gain = gain(1)
	const meter = new NumberedTreeNodeImpl(2, meterParameter)
	const ch1 = new NumberedTreeNodeImpl(1, new EmberNodeImpl('Ch1'), childrenOf([ch1Gain, meter]))
	const ch2 = new NumberedTreeNodeImpl(2, new EmberNodeImpl('Ch2'), childrenOf([gain(1)]))
	const inputs = new NumberedTreeNodeImpl(1, new EmberNodeImpl('Inputs'), childrenOf([ch1, ch2]))
	const level = new ParameterImpl(ParameterType.Integer, 'Level', undefined, 0)
	level.access = ParameterAccess.ReadWrite
	const outputs = new NumberedTreeNodeImpl(
		4,
		new EmberNodeImpl('Outputs'),
		childrenOf([new NumberedTreeNodeImpl(1, level)]),
	)
	const recall = new NumberedTreeNodeImpl(2, new EmberModel.EmberFunctionImpl('Recall'))
	const router = new EmberModel.MatrixImpl('Router')
	router.targets = new Map([[1, {}]])
	router.sources = new Map([[1, {}]])
	const tree = childrenOf([
		new NumberedTreeNodeImpl(
			1,
			new EmberNodeImpl('device'),
			childrenOf([inputs, recall, new NumberedTreeNodeImpl(3, router), outputs]),
		),
	])
	return { tree, ch1Gain, meter }
}

let server: EmberServer | undefined
let instance: EmberPlusInstance | undefined

afterEach(async () => {
	await instance?.destroy()
	server?.discard()
	instance = undefined
	server = undefined
})

async function connect(config: Partial<EmberPlusConfig>) {
	const port = await freePort()
	const { tree, ch1Gain, meter } = providerTree()
	server = new EmberServer(port)
	const provider = server
	provider.onSetValue = async (parameter, value) => {
		provider.update(parameter, { value })
		return true
	}
	await provider.init(tree)
	instance = new EmberPlusInstance('test')
	const configured: EmberPlusConfig = {
		host: '127.0.0.1',
		port,
		factor: true,
		verbose: false,
		variables: ['parameterValues'],
		...config,
	}
	await instance.init(configured)
	const self = instance as any
	await vi.waitFor(() => expect(logged(self, 'Discovered ')).toBeDefined(), { timeout: 3000 })
	return { instance: self, server: provider, ch1Gain, meter, config: configured }
}

/** The first message logged at that level starting with this, or undefined */
function logged(instance: any, start: string, level = 'info'): string | undefined {
	return instance.log.mock.calls.find(([l, m]: [string, string]) => l === level && m.startsWith(start))?.[1]
}

function latest(mock: { mock: { calls: unknown[][] } }): Record<string, any> {
	return mock.mock.calls.at(-1)?.[0] as Record<string, any>
}

function variables(instance: any): Record<string, unknown> {
	return Object.assign({}, ...instance.setVariableValues.mock.calls.map(([values]: [object]) => values))
}

/**
 * Whether a variable got a value only once defined, as the module host needs: it drops, as a deletion, a value for a
 * variable it has no definition of
 */
function valuesAfterDefinition(instance: any, id: string): boolean {
	const definitions = instance.setVariableDefinitions.mock
	const values = instance.setVariableValues.mock
	const defined = definitions.calls.findIndex(([variables]: [object]) => id in variables)
	if (defined < 0) return false
	const definedAt = definitions.invocationCallOrder[defined]
	const set = values.calls.map(([v]: [object], i: number) => [v, values.invocationCallOrder[i]] as const)
	const withValue = set.filter(([v]: readonly [object, number]) => id in v)
	return withValue.length > 0 && withValue.every(([, at]: readonly [object, number]) => at > definedAt)
}

/** The ids of a definition's path dropdown */
function pathChoices(definitions: Record<string, any>, id: string): string[] {
	return definitions[id].options.find((o: any) => o.id === 'path').choices.map((c: any) => c.id)
}

describe('discovery against a provider', () => {
	it('lists the parameters and functions the patterns match, and logs the matrices for the config', async () => {
		const { instance } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain, device.Recall, device.Router' })
		await vi.waitFor(() =>
			expect(pathChoices(latest(instance.setActionDefinitions), 'setValueInt')).toContain('1.1.2.1'),
		)
		const actions = latest(instance.setActionDefinitions)
		expect(pathChoices(actions, 'setValueInt')).toEqual(['1.1.1.1', '1.1.2.1'])
		expect(actions.invokeFunction.options[0].choices.map((c: any) => c.id)).toContain('1.2')
		expect(logged(instance, 'Discovered 2 parameters, 1 functions and 1 matrices')).toBeDefined()
		expect(logged(instance, 'Discovered matrices')).toContain('1.3 (device.Router)')
		// Not loaded: matrices come from the config
		expect(instance.state.matrices.size).toBe(0)
	})

	describe('with Parameter - Values', () => {
		it('gives discovered parameters variables, follows their changes, and registers no callback for them', async () => {
			const { instance, server, ch1Gain } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain' })
			await vi.waitFor(() => expect(Object.keys(latest(instance.setVariableDefinitions))).toContain('1.1.1.1'))
			expect(Object.keys(latest(instance.setVariableDefinitions))).toContain('1.1.2.1')
			await vi.waitFor(() => expect(variables(instance)['1.1.2.1']).toBe(0))
			expect(variables(instance)['1.1.1.1']).toBe(0)
			// Each value sent once its variable was defined, or the host would have dropped it
			expect(valuesAfterDefinition(instance, '1.1.1.1')).toBe(true)
			expect(valuesAfterDefinition(instance, '1.1.2.1')).toBe(true)

			server.update(ch1Gain, { value: 7 })
			await vi.waitFor(() => expect(variables(instance)['1.1.1.1']).toBe(7))
			// Through the 'change' event: no callback each, and so no GetDirectory each, now or after a reconnect
			expect(instance.pathCallbacks.has('1.1.1.1')).toBe(false)
		})

		// A reconnect registers the monitored paths again: not the discovered ones, which the library resubscribes itself
		it("doesn't register the discovered parameters again with the others", async () => {
			const { instance } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain' })
			const lookups = vi.spyOn(instance.emberClient, 'getElementByPath')
			await instance.registerParameters()
			expect(lookups).not.toHaveBeenCalled()
		})

		// Discovery never subscribes to a stream: a meter is listed for a feedback, and streams only while one reads it
		it('lists a stream parameter but neither subscribes to it nor gives it a variable', async () => {
			const { instance, server, meter } = await connect({
				discoveryPatterns: 'device.Inputs.**',
				variables: ['parameterValues', 'parameterStreams'],
			})
			await vi.waitFor(() =>
				expect(pathChoices(latest(instance.setFeedbackDefinitions), 'parameter_property')).toContain('1.1.1.2'),
			)
			expect(Object.keys(latest(instance.setVariableDefinitions))).not.toContain('1.1.1.2')
			const subscriptions = (server as unknown as { _streamSubscriptions: Map<string, Set<unknown>> })
				._streamSubscriptions
			expect(subscriptions.get('1.1.1.2')?.size ?? 0).toBe(0)

			// A change to it still updates what is listed, and sets no variable
			instance.setVariableValues.mockClear()
			server.update(meter, { description: 'Left' })
			await vi.waitFor(() => expect(instance.state.parameters.get('1.1.1.2')?.description).toBe('Left'))
			expect(variables(instance)).not.toHaveProperty('1.1.1.2')
		})
	})

	describe('without Parameter - Values', () => {
		it('lists discovered parameters, with no variables, their values still followed', async () => {
			const { instance, server, ch1Gain } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain', variables: [] })
			await vi.waitFor(() =>
				expect(pathChoices(latest(instance.setActionDefinitions), 'setValueInt')).toContain('1.1.1.1'),
			)
			expect(Object.keys(latest(instance.setVariableDefinitions))).not.toContain('1.1.1.1')

			server.update(ch1Gain, { value: 4 })
			await vi.waitFor(() => expect(instance.state.parameters.get('1.1.1.1')?.value).toBe(4))
			expect(variables(instance)).not.toHaveProperty('1.1.1.1')
		})

		// Used by an action, it is registered as any path is, with a callback of its own
		it('registers a listed parameter an action uses', async () => {
			const { instance, server, ch1Gain } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain', variables: [] })
			await vi.waitFor(() =>
				expect(pathChoices(latest(instance.setActionDefinitions), 'setValueInt')).toContain('1.1.1.1'),
			)
			const setValueInt = latest(instance.setActionDefinitions).setValueInt
			await setValueInt.callback(
				{ id: 'act1', options: { path: '1.1.1.1', value: 3, relative: false, deviceUnits: false } },
				{ signal: new AbortController().signal },
			)
			await vi.waitFor(() => expect(instance.state.parameters.get('1.1.1.1')?.value).toBe(3))
			expect(instance.pathCallbacks.has('1.1.1.1')).toBe(true)

			// Its changes then come through its callback alone, not the 'change' event as well
			const handled = vi.spyOn(instance, 'handleChangedValue')
			server.update(ch1Gain, { value: 9 })
			await vi.waitFor(() => expect(instance.state.parameters.get('1.1.1.1')?.value).toBe(9))
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(handled.mock.calls.filter(([path]) => path === '1.1.1.1')).toHaveLength(1)
		})
	})

	it('forgets what a later discovery no longer finds, after a config change', async () => {
		const { instance, config } = await connect({ discoveryPatterns: 'device.Inputs.*.Gain, device.Outputs.**' })
		await vi.waitFor(() => expect(pathChoices(latest(instance.setActionDefinitions), 'setValueInt')).toContain('1.4.1'))
		instance.log.mockClear()
		await instance.configUpdated({ ...config, discoveryPatterns: 'device.Outputs.**' })
		await vi.waitFor(() => expect(logged(instance, 'Discovered 1 parameters')).toBeDefined(), { timeout: 3000 })
		expect(pathChoices(latest(instance.setActionDefinitions), 'setValueInt')).toEqual(['1.4.1'])
		expect(Object.keys(latest(instance.setVariableDefinitions))).not.toContain('1.1.1.1')
		expect(instance.state.parameters.has('1.1.1.1')).toBe(false)
	})

	// In the log only: the connection is fine, and the status is about the connection (the user's call, 2026-11-28)
	it('stops at the node limit, and warns in the log, leaving the status', async () => {
		const status = vi.spyOn(StatusManager.prototype, 'updateStatus')
		const { instance } = await connect({ discoveryPatterns: '**', discoveryNodeLimit: 2 })
		await vi.waitFor(() =>
			expect(logged(instance, 'Discovery stopped at the Discovery Node Limit', 'warn')).toBeDefined(),
		)
		expect(logged(instance, 'Discovered ')).toContain('walking 2 nodes')
		expect(status.mock.calls.some(([, message]) => typeof message === 'string' && message.includes('Discovery'))).toBe(
			false,
		)
		status.mockRestore()
	})

	it('walks nothing without patterns', async () => {
		const port = await freePort()
		server = new EmberServer(port)
		await server.init(providerTree().tree)
		instance = new EmberPlusInstance('test')
		const self = instance as any
		await instance.init({ host: '127.0.0.1', port, factor: true, verbose: false, variables: ['parameterValues'] })
		await vi.waitFor(() => expect(self.clientSetUp).toBe(true), { timeout: 3000 })
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(logged(self, 'Discovered ')).toBeUndefined()
		expect(self.state.parameters.size).toBe(0)
	})
})
