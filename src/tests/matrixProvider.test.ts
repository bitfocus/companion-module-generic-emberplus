import { describe, it, expect, vi, afterEach } from 'vitest'
import { createServer, type AddressInfo } from 'node:net'
import { EmberServer, Model as EmberModel } from '@phillipivan/emberplus-connection'
import EmberPlusInstance from '../index.js'
import type { EmberPlusConfig } from '../config.js'
import { captureLogs } from './logs.js'

// The module against the library's own provider, over TCP: loading the configured matrices, their labels and
// connections, and following their changes. Only Companion's side, InstanceBase, is faked.
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
		checkFeedbacks = vi.fn()
		checkFeedbacksById = vi.fn()
		checkAllFeedbacks = vi.fn()
		subscribeActions = vi.fn()
		recordAction = vi.fn()
		saveConfig = vi.fn()
	},
}))

const {
	childrenOf,
	connectionsOf,
	EmberNodeImpl,
	LabelImpl,
	MatrixAddressingMode,
	MatrixImpl,
	MatrixType,
	NumberedTreeNodeImpl,
	ParameterImpl,
	ParameterType,
} = EmberModel

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

function label(number: number, value: string) {
	return new NumberedTreeNodeImpl(number, new ParameterImpl(ParameterType.String, `label ${number}`, undefined, value))
}

/**
 * A device at 1: a 1:N matrix at 1.1, its targets 1 and 2 and sources 1 to 3, named by identifier, with one label set
 * at 1.2 (target 1, sources 1 and 3); target 1 connected to source 1. And a parameter at 1.3, which is no matrix.
 */
function providerTree() {
	const router = new MatrixImpl('router')
	router.description = 'Router'
	router.matrixType = MatrixType.OneToN
	router.addressingMode = MatrixAddressingMode.NonLinear
	router.targetCount = 2
	router.sourceCount = 3
	router.targets = new Map([
		[1, { identifier: 'Out 1' }],
		[2, { identifier: 'Out 2' }],
	])
	router.sources = new Map([
		[1, { identifier: 'In 1' }],
		[2, { identifier: 'In 2' }],
		[3, { identifier: 'In 3' }],
	])
	router.connections = connectionsOf([{ target: 1, sources: [1] }, { target: 2 }])
	router.labels = [new LabelImpl('1.2', 'Primary')]
	const matrix = new NumberedTreeNodeImpl(1, router)
	const labels = new NumberedTreeNodeImpl(
		2,
		new EmberNodeImpl('labels'),
		childrenOf([
			new NumberedTreeNodeImpl(1, new EmberNodeImpl('targets'), childrenOf([label(1, 'Studio A')])),
			new NumberedTreeNodeImpl(2, new EmberNodeImpl('sources'), childrenOf([label(1, 'Mic 1'), label(3, 'Mic 3')])),
		]),
	)
	const level = new NumberedTreeNodeImpl(3, new ParameterImpl(ParameterType.Integer, 'level', undefined, 0))
	const tree = childrenOf([
		new NumberedTreeNodeImpl(1, new EmberNodeImpl('device'), childrenOf([matrix, labels, level])),
	])
	return { tree, matrix }
}

let server: EmberServer | undefined
let instance: EmberPlusInstance | undefined

afterEach(async () => {
	await instance?.destroy()
	server?.discard()
	instance = undefined
	server = undefined
})

/** The provider, applying consumers' connection requests, and an instance connected to it */
async function connect(tree: EmberModel.Children, config: Partial<EmberPlusConfig> = {}) {
	const port = await freePort()
	server = new EmberServer(port)
	const provider = server
	// The operations consumers asked for, as the provider got them
	const operations: Array<string | undefined> = []
	provider.onMatrixOperation = async (matrix, connections) => {
		for (const connection of connections.values()) {
			operations.push(connection.operation)
			provider.updateMatrixConnection(matrix, connection)
		}
	}
	await provider.init(tree)
	instance = new EmberPlusInstance('test')
	const configured: EmberPlusConfig = {
		host: '127.0.0.1',
		port,
		factor: true,
		verbose: false,
		variables: ['matrixTargetNames', 'matrixSourceNames', 'matrixConnections'],
		...config,
	}
	await instance.init(configured)
	return { instance: instance as any, server: provider, operations, config: configured }
}

/** The values the instance has set for these variables, the latest of each */
function variables(instance: any): Record<string, unknown> {
	return Object.assign({}, ...instance.setVariableValues.mock.calls.map(([values]: [object]) => values))
}

/** The latest definitions the instance has set */
function latest(mock: { mock: { calls: unknown[][] } }): Record<string, any> {
	return mock.mock.calls.at(-1)?.[0] as Record<string, any>
}

describe('matrices from a provider', () => {
	it('loads each configured matrix, with its labels, and drops the paths that hold none', async () => {
		const { tree } = providerTree()
		const { instance } = await connect(tree, { matricesString: '1.1, 1.3, 9.9' })

		await vi.waitFor(() => expect(instance.state.matrices.get('1.1')?.labels.sources.size).toBe(2), { timeout: 3000 })
		expect([...instance.state.matrices.keys()]).toEqual(['1.1'])
		const warnings = instance.log.mock.calls.filter(([level]: [string]) => level === 'warn').map(([, m]: string[]) => m)
		expect(warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Matrix 1.3 is not a matrix'),
				expect.stringContaining('Matrix 9.9 was not found'),
			]),
		)

		// Each signal by its first label, or else its identifier
		await vi.waitFor(() =>
			expect(variables(instance)).toMatchObject({
				'matrix_1.1_target_1_name': 'Studio A',
				'matrix_1.1_target_2_name': 'Out 2',
				'matrix_1.1_source_1_name': 'Mic 1',
				'matrix_1.1_source_2_name': 'In 2',
				'matrix_1.1_source_3_name': 'Mic 3',
				'matrix_1.1_target_1_sources': 1,
				'matrix_1.1_target_2_sources': null,
			}),
		)
		expect(Object.keys(latest(instance.setVariableDefinitions))).toEqual(
			expect.arrayContaining(['matrix_1.1_target_1_name', 'matrix_1.1_source_3_name', 'matrix_1.1_target_2_sources']),
		)

		// The dropdowns list the matrix's signals by number and name, once the definitions are rebuilt
		await vi.waitFor(
			() => {
				const options = latest(instance.setActionDefinitions).matrixConnect.options
				// By its path's identifiers, the node's above it too
				expect(options.find((o: any) => o.id === 'matrix').choices).toEqual([
					{ id: '1.1', label: '1.1: device.router' },
				])
				expect(options.find((o: any) => o.id === 'target_1_1').choices).toEqual([
					{ id: 1, label: '1: Studio A' },
					{ id: 2, label: '2: Out 2' },
				])
			},
			{ timeout: 2000 },
		)
	})

	// Offered while configured, then dropped once the provider shows none to be a matrix
	it('stops offering the matrix actions and feedbacks once none of the configured matrices is one', async () => {
		const { tree } = providerTree()
		const { instance } = await connect(tree, { matricesString: '1.3, 9.9' })
		expect(instance.setActionDefinitions.mock.calls[0][0].matrixConnect).toBeDefined()
		await vi.waitFor(() => expect(instance.state.matrices.size).toBe(0), { timeout: 3000 })
		await vi.waitFor(
			() => {
				expect(latest(instance.setActionDefinitions).matrixConnect).toBeUndefined()
				expect(latest(instance.setFeedbackDefinitions).matrix_property).toBeUndefined()
			},
			{ timeout: 2000 },
		)
	})

	it("follows the provider's connections, rechecking the Matrix Property feedbacks reading the matrix", async () => {
		const { tree, matrix } = providerTree()
		const { instance, server } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_sources']).toBeNull(), { timeout: 3000 })

		const property = latest(instance.setFeedbackDefinitions).matrix_property
		const feedback = {
			id: 'fb1',
			options: { matrix: '1.1', signal: 'target', target_1_1: 2, targetProperty: 'connections' },
		}
		expect(property.callback(feedback)).toBeNull()

		instance.setVariableValues.mockClear()
		server.updateMatrixConnection(matrix, { target: 2, sources: [3] })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_sources']).toBe(3))
		// Only the variable the report changed: a large matrix has thousands
		expect(variables(instance)).toEqual({ 'matrix_1.1_target_2_sources': 3 })
		await vi.waitFor(() => expect(instance.checkFeedbacksById).toHaveBeenCalledWith('fb1'))
		expect(property.callback(feedback)).toBe(3)
		expect(property.callback({ ...feedback, options: { ...feedback.options, targetProperty: 'disposition' } })).toBe(
			'modified',
		)
	})

	// A signal's identifier comes with the matrix's own reports, so it is followed live; labels are read on connecting
	it('follows a signal renamed by the provider, in the dropdowns and the variables', async () => {
		const { tree, matrix } = providerTree()
		const { instance, server } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_name']).toBe('Out 2'), { timeout: 3000 })

		server.update(matrix, {
			targets: new Map([
				[1, { identifier: 'Out 1' }],
				[2, { identifier: 'Booth' }],
			]),
		})
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_name']).toBe('Booth'))
		await vi.waitFor(
			() => {
				const options = latest(instance.setActionDefinitions).setSelectedTarget.options
				expect(options.find((o: any) => o.id === 'target_1_1').choices).toContainEqual({ id: 2, label: '2: Booth' })
			},
			{ timeout: 2000 },
		)
	})

	// The Glow DTD has connect and disconnect for an N:N matrix only: a 1:N matrix is sent absolute
	it("connects a source with Matrix Connect, from the chosen matrix's fields, as absolute on a 1:N matrix", async () => {
		const { tree } = providerTree()
		const { instance, operations } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_1_sources']).toBe(1), { timeout: 3000 })

		const action = latest(instance.setActionDefinitions).matrixConnect
		await action.callback(
			{ options: { matrix: '1.1', target_1_1: 1, sources_1_1: 2 } },
			{ signal: new AbortController().signal },
		)
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_1_sources']).toBe(2))
		expect(operations).toEqual([EmberModel.ConnectionOperation.Absolute])
	})

	it('disconnects the connected source with Matrix Disconnect, as absolute without it on a 1:N matrix', async () => {
		const { tree } = providerTree()
		const { instance, operations } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_1_sources']).toBe(1), { timeout: 3000 })

		const action = latest(instance.setActionDefinitions).matrixDisconnect
		await action.callback(
			{ options: { matrix: '1.1', target_1_1: 1, sources_1_1: 1 } },
			{ signal: new AbortController().signal },
		)
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_1_sources']).toBeNull())
		expect(operations).toEqual([EmberModel.ConnectionOperation.Absolute])
	})

	// As a parameter's reported value is recorded as a Set Value action
	it("records the provider's connection changes as Matrix Set Connection actions, once per target, while recording", async () => {
		const { tree, matrix } = providerTree()
		const { instance, server } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_1_sources']).toBe(1), { timeout: 3000 })

		// Not recording: nothing
		server.updateMatrixConnection(matrix, { target: 2, sources: [2] })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_sources']).toBe(2))
		expect(instance.recordAction).not.toHaveBeenCalled()

		instance.handleStartStopRecordActions(true)
		server.updateMatrixConnection(matrix, { target: 2, sources: [3] })
		await vi.waitFor(() =>
			expect(instance.recordAction).toHaveBeenCalledWith(
				{ actionId: 'matrixSetConnection', options: { matrix: '1.1', target_1_1: 2, sources_1_1: 3 } },
				'1.1:2',
			),
		)
		// Only the target that changed, not target 1
		expect(instance.recordAction).toHaveBeenCalledTimes(1)

		// A target left with no source is recorded with None, which disconnects it
		instance.recordAction.mockClear()
		server.updateMatrixConnection(matrix, { target: 1, sources: [] })
		await vi.waitFor(() =>
			expect(instance.recordAction).toHaveBeenCalledWith(
				{ actionId: 'matrixSetConnection', options: { matrix: '1.1', target_1_1: 1, sources_1_1: -1 } },
				'1.1:1',
			),
		)

		instance.recordAction.mockClear()
		instance.handleStartStopRecordActions(false)
		server.updateMatrixConnection(matrix, { target: 2, sources: [1] })
		await vi.waitFor(() => expect(variables(instance)['matrix_1.1_target_2_sources']).toBe(1))
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(instance.recordAction).not.toHaveBeenCalled()
	})

	// Loading every target's connection isn't a change to record
	it('records nothing as the matrix loads, while recording', async () => {
		const { tree, matrix } = providerTree()
		const port = await freePort()
		server = new EmberServer(port)
		await server.init(tree)
		instance = new EmberPlusInstance('test')
		const recording = instance as any
		recording.handleStartStopRecordActions(true)
		await instance.init({
			host: '127.0.0.1',
			port,
			factor: true,
			verbose: false,
			variables: ['matrixConnections'],
			matricesString: '1.1',
		})
		await vi.waitFor(() => expect(variables(recording)['matrix_1.1_target_1_sources']).toBe(1), { timeout: 3000 })
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(recording.recordAction).not.toHaveBeenCalled()

		server.updateMatrixConnection(matrix, { target: 2, sources: [3] })
		await vi.waitFor(() => expect(recording.recordAction).toHaveBeenCalledTimes(1))
	})

	it("reads labels given by each signal's labels node", async () => {
		const sources = new MatrixImpl('router')
		sources.addressingMode = MatrixAddressingMode.NonLinear
		sources.targets = new Map([[1, { labelsLocation: '1.2.1' }]])
		sources.sources = new Map([[4, { identifier: 'In 4', labelsLocation: '1.2.2' }]])
		sources.connections = connectionsOf([{ target: 1 }])
		const tree = childrenOf([
			new NumberedTreeNodeImpl(
				1,
				new EmberNodeImpl('device'),
				childrenOf([
					new NumberedTreeNodeImpl(1, sources),
					new NumberedTreeNodeImpl(
						2,
						new EmberNodeImpl('labels'),
						childrenOf([
							// The first label is the lowest numbered
							new NumberedTreeNodeImpl(
								1,
								new EmberNodeImpl('target 1'),
								childrenOf([label(2, 'Long'), label(1, 'Mon')]),
							),
							new NumberedTreeNodeImpl(2, new EmberNodeImpl('source 4'), childrenOf([label(1, 'Cam 4')])),
						]),
					),
				]),
			),
		])
		const { instance } = await connect(tree, { matricesString: '1.1' })
		await vi.waitFor(
			() =>
				expect(variables(instance)).toMatchObject({
					'matrix_1.1_target_1_name': 'Mon',
					'matrix_1.1_source_4_name': 'Cam 4',
				}),
			{ timeout: 3000 },
		)
	})
})

describe('matrix variables, as the Connection Variables choose them', () => {
	/** The ids of the signals' variables, which the Connection Variables choose (not the matrix's own) */
	const matrixIds = (values: Record<string, unknown> | undefined) =>
		Object.keys(values ?? {}).filter((id) => /^matrix_.+_(target|source)_\d+_/.test(id))

	/** Connected, with matrix 1.1 loaded, labels and all */
	async function loaded(variables: EmberPlusConfig['variables']) {
		const { tree } = providerTree()
		const connected = await connect(tree, { matricesString: '1.1', variables })
		await vi.waitFor(() => expect(connected.instance.state.matrices.get('1.1')?.labels.sources.size).toBe(2), {
			timeout: 3000,
		})
		// Let the throttled update after loading run
		await new Promise((resolve) => setTimeout(resolve, 50))
		return connected
	}

	it('defines and sets only the kinds chosen', async () => {
		const { instance } = await loaded(['matrixConnections'])
		const ids = ['matrix_1.1_target_1_sources', 'matrix_1.1_target_2_sources']
		expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual(ids)
		expect(matrixIds(variables(instance))).toEqual(ids)
	})

	it("defines and sets no signal's with no Matrix choice, but the matrix's own", async () => {
		const { instance } = await loaded(['parameterValues'])
		expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual([])
		expect(matrixIds(variables(instance))).toEqual([])
		expect(latest(instance.setVariableDefinitions)).toMatchObject({
			'matrix_1.1_name': { name: 'Matrix 1.1: Name' },
			'matrix_1.1_targets': { name: 'Matrix 1.1: Targets' },
			'matrix_1.1_sources': { name: 'Matrix 1.1: Sources' },
			'matrix_1.1_type': { name: 'Matrix 1.1: Type' },
		})
		expect(variables(instance)).toMatchObject({
			// Its description
			'matrix_1.1_name': 'Router',
			'matrix_1.1_targets': [1, 2],
			'matrix_1.1_sources': [1, 2, 3],
			'matrix_1.1_type': 'oneToN',
		})
	})

	it('defines and sets them once chosen in the config', async () => {
		const { instance, config } = await loaded(['parameterValues'])
		await instance.configUpdated({ ...config, variables: ['matrixTargetNames', 'matrixSourceNames'] })
		await vi.waitFor(() =>
			expect(variables(instance)).toMatchObject({
				'matrix_1.1_target_1_name': 'Studio A',
				'matrix_1.1_source_3_name': 'Mic 3',
			}),
		)
		expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual([
			'matrix_1.1_target_1_name',
			'matrix_1.1_target_2_name',
			'matrix_1.1_source_1_name',
			'matrix_1.1_source_2_name',
			'matrix_1.1_source_3_name',
		])
	})

	it('drops them once unchosen in the config', async () => {
		const { instance, config } = await loaded(['matrixTargetNames', 'matrixConnections'])
		expect(matrixIds(latest(instance.setVariableDefinitions)).length).toBe(4)
		await instance.configUpdated({ ...config, variables: ['parameterValues'] })
		await vi.waitFor(() => expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual([]))
	})

	// Companion drops a variable's value with its definition: chosen again, every value is set again, changed or not
	it('sets them all again once chosen again', async () => {
		const { instance, config } = await loaded(['matrixConnections'])
		await instance.configUpdated({ ...config, variables: ['parameterValues'] })
		await vi.waitFor(() => expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual([]))
		instance.setVariableValues.mockClear()
		await instance.configUpdated({ ...config, variables: ['matrixConnections'] })
		await vi.waitFor(() =>
			expect(variables(instance)).toMatchObject({
				'matrix_1.1_target_1_sources': 1,
				'matrix_1.1_target_2_sources': null,
			}),
		)
	})

	// The matrix was loaded before the provider went: what is known of it is set, without waiting for a reconnect
	it('sets them once chosen while the provider is unreachable', async () => {
		const { instance, server, config } = await loaded(['parameterValues'])
		// The provider stops listening, and drops the connection it has
		const clients = [...(server as unknown as { _clients: Set<{ disconnect(): Promise<void> }> })._clients]
		server.discard()
		await Promise.all(clients.map(async (client) => client.disconnect()))
		await vi.waitFor(() => expect(instance.emberClient.connected).toBe(false))
		await instance.configUpdated({ ...config, variables: ['matrixConnections'] })
		await vi.waitFor(() => expect(variables(instance)).toMatchObject({ 'matrix_1.1_target_1_sources': 1 }), {
			timeout: 3000,
		})
		expect(matrixIds(latest(instance.setVariableDefinitions))).toEqual([
			'matrix_1.1_target_1_sources',
			'matrix_1.1_target_2_sources',
		])
	})
})
