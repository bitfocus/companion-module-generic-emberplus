import { describe, it, expect, vi, afterEach } from 'vitest'
import { createServer, type AddressInfo } from 'node:net'
import { EmberServer, Model as EmberModel } from '@phillipivan/emberplus-connection'
import EmberPlusInstance from '../index.js'
import type { EmberPlusConfig } from '../config.js'
import { captureLogs } from './logs.js'

// The module against the library's own provider, over TCP: the provider sends a stream parameter's values only to the
// consumers that subscribed to it, so this is where a Subscribe or an Unsubscribe the module failed to send shows. Only
// Companion's side, InstanceBase, is faked.
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

const { ParameterType, ParameterAccess } = EmberModel

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

/** A meter at 1.1, a stream parameter, raw values tenths of a dB (formula), and an ordinary level at 1.2 */
function providerTree() {
	const meterParameter = new EmberModel.ParameterImpl(ParameterType.Integer, 'meter', undefined, 0)
	meterParameter.access = ParameterAccess.Read
	meterParameter.streamIdentifier = 4
	meterParameter.formula = '$ / 10\n$ * 10'
	const meter = new EmberModel.NumberedTreeNodeImpl(1, meterParameter)
	const levelParameter = new EmberModel.ParameterImpl(ParameterType.Integer, 'level', undefined, 0)
	levelParameter.access = ParameterAccess.ReadWrite
	const level = new EmberModel.NumberedTreeNodeImpl(2, levelParameter)
	const tree = EmberModel.childrenOf([
		new EmberModel.NumberedTreeNodeImpl(
			1,
			new EmberModel.EmberNodeImpl('meters'),
			EmberModel.childrenOf([meter, level]),
		),
	])
	return { tree, meter }
}

let server: EmberServer | undefined
let instance: EmberPlusInstance | undefined

afterEach(async () => {
	await instance?.destroy()
	server?.discard()
	instance = undefined
	server = undefined
})

/** The provider and a connected, set up instance */
async function connect(config: Partial<EmberPlusConfig> = {}) {
	const port = await freePort()
	const { tree, meter } = providerTree()
	server = new EmberServer(port)
	await server.init(tree)
	instance = new EmberPlusInstance('test')
	await instance.init({
		host: '127.0.0.1',
		port,
		factor: true,
		verbose: false,
		variables: ['parameterValues'],
		...config,
	})
	await vi.waitFor(() => expect((instance as any).clientSetUp).toBe(true), { timeout: 3000 })
	const provider = server
	const subscribers = (path: string) =>
		(provider as unknown as { _streamSubscriptions: Map<string, Set<unknown>> })._streamSubscriptions.get(path)?.size ??
		0
	return { instance, server, meter, subscribers }
}

describe('streams from a provider', () => {
	it('subscribes for a feedback on a meter, rechecks it with each value, and unsubscribes when it goes', async () => {
		const { instance, server, meter, subscribers } = await connect()

		await instance.useParameterForFeedback('fb1', '1.1')
		await vi.waitFor(() => expect(subscribers('1.1')).toBe(1))

		server.update(meter, { value: -125 })
		await vi.waitFor(() => expect((instance as any).state.parameters.get('1.1')?.value).toBe(-125))
		await vi.waitFor(() => expect((instance as any).checkFeedbacksById).toHaveBeenCalledWith('fb1'))

		instance.releaseParameterFeedback('fb1')
		await vi.waitFor(() => expect(subscribers('1.1')).toBe(0))
		server.update(meter, { value: -300 })
		await new Promise((resolve) => setTimeout(resolve, 100))
		expect((instance as any).state.parameters.get('1.1')?.value).toBe(-125)
	})

	it('gives a monitored meter a variable with Parameter - Streams, as displayed by its formula', async () => {
		const { instance, server, meter, subscribers } = await connect({
			variables: ['parameterStreams'],
			monitoredParametersString: '1.1',
		})
		await vi.waitFor(() => expect(subscribers('1.1')).toBe(1))

		server.update(meter, { value: -125 })
		await vi.waitFor(() =>
			expect((instance as any).setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ '1.1': -12.5 })),
		)
	})

	// The configured path is registered, so a feedback on it works, but nothing needs its values streamed
	it('does not stream a monitored meter without Parameter - Streams or a feedback', async () => {
		const { subscribers } = await connect({ monitoredParametersString: '1.1' })
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(subscribers('1.1')).toBe(0)
	})
})

describe('presets from a provider', () => {
	// The identifiers come from the library's own tree, by each element's parent
	it("meters a registered stream, named by its path's identifiers, and gives no rotary to a number without a range", async () => {
		const { instance } = await connect({ monitoredParametersString: '1.1, 1.2' })
		await vi.waitFor(
			() => {
				const [structure, presets] = (instance as any).setPresetDefinitions.mock.calls.at(-1)
				// No matrix configured: no XY buttons
				expect(structure.map((section: { id: string }) => section.id)).toEqual(['meters'])
				expect(structure[0].definitions).toEqual([
					expect.objectContaining({
						type: 'template',
						presetId: 'meter',
						templateValues: [{ name: 'meters.meter', value: '1.1' }],
					}),
				])
				expect(Object.keys(presets)).toEqual(['meter'])
			},
			{ timeout: 3000 },
		)
	})

	// What a placed meter reads its name and range by
	it("gives a stream's path by identifiers through Parameter Property, from the library's tree", async () => {
		const { instance } = await connect({ monitoredParametersString: '1.1' })
		await vi.waitFor(() => expect((instance as any).state.parameters.has('1.1')).toBe(true), { timeout: 3000 })
		const property = (instance as any).setFeedbackDefinitions.mock.calls.at(-1)[0].parameter_property
		const read = async (name: string) =>
			property.callback(
				{ id: name, options: { path: '1.1', property: name } },
				{ signal: new AbortController().signal },
			)
		expect(await read('identifierPath')).toBe('meters.meter')
	})
})
