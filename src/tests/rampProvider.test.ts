import { describe, it, expect, vi, afterEach } from 'vitest'
import { createServer, type AddressInfo } from 'node:net'
import { EmberServer, Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import { ActionId } from '../actions.js'
import EmberPlusInstance from '../index.js'
import { captureLogs } from './logs.js'

// Ramp Value against the library's own provider, over TCP, with real timers: what the provider receives is what a
// device would. Only Companion's side, InstanceBase, is faked.
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

let server: EmberServer | undefined
let instance: EmberPlusInstance | undefined

afterEach(async () => {
	await instance?.destroy()
	server?.discard()
	instance = undefined
	server = undefined
})

/** A provider with a gain at 1.1, in tenths of a dB (factor 10), at 0 dB, which applies and records each value set */
async function connect() {
	const gainParameter = new EmberModel.ParameterImpl(ParameterType.Integer, 'gain', undefined, 0)
	gainParameter.access = ParameterAccess.ReadWrite
	gainParameter.factor = 10
	gainParameter.minimum = -900
	gainParameter.maximum = 100
	const tree = EmberModel.childrenOf([
		new EmberModel.NumberedTreeNodeImpl(
			1,
			new EmberModel.EmberNodeImpl('channel'),
			EmberModel.childrenOf([new EmberModel.NumberedTreeNodeImpl(1, gainParameter)]),
		),
	])
	const port = await freePort()
	const provider = new EmberServer(port)
	server = provider
	const received: EmberTypes.EmberValue[] = []
	provider.onSetValue = async (parameter, value) => {
		received.push(value)
		provider.update(parameter, { value })
		return true
	}
	await provider.init(tree)
	instance = new EmberPlusInstance('test')
	await instance.init({
		host: '127.0.0.1',
		port,
		factor: true,
		verbose: false,
		variables: ['parameterValues'],
		rampInterval: 20,
	})
	await vi.waitFor(() => expect((instance as any).clientSetUp).toBe(true), { timeout: 3000 })
	const rampValue = (instance as any).setActionDefinitions.mock.lastCall[0][ActionId.RampValue]
	return { instance, received, rampValue }
}

describe('Ramp Value against a provider', () => {
	it('sends a rising sequence of steps, ending exactly at the target, and waits for it', async () => {
		const { instance, received, rampValue } = await connect()
		const started = performance.now()
		await rampValue.callback(
			{ id: 'act1', options: { path: '1.1', value: 6, duration: 300, easing: 'linear', relative: false } },
			{ signal: new AbortController().signal },
		)
		expect(performance.now() - started).toBeGreaterThanOrEqual(290)

		// Several steps, each above the last, the last the target: 6 dB, 60 in tenths
		expect(received.length).toBeGreaterThan(3)
		for (let i = 1; i < received.length; i++) expect(received[i]).toBeGreaterThan(received[i - 1] as number)
		expect(received.at(-1)).toBe(60)
		await vi.waitFor(() => expect((instance as any).state.parameters.get('1.1')?.value).toBe(60))
	})

	it('a second ramp stops the first, and carries on from where it had reached', async () => {
		const { received, rampValue } = await connect()
		const first = rampValue.callback(
			{ id: 'act1', options: { path: '1.1', value: 6, duration: 1000, easing: 'linear', relative: false } },
			{ signal: new AbortController().signal },
		)
		await vi.waitFor(() => expect(received.length).toBeGreaterThan(3))
		await rampValue.callback(
			{ id: 'act2', options: { path: '1.1', value: -6, duration: 200, easing: 'linear', relative: false } },
			{ signal: new AbortController().signal },
		)
		await first

		const turn = received.findIndex((value, i) => i > 0 && (value as number) < (received[i - 1] as number))
		expect(turn).toBeGreaterThan(0)
		// Up to where the first had reached, never to its target, then down, without a jump back to the start
		expect(Math.max(...(received as number[]))).toBeLessThan(60)
		for (let i = turn + 1; i < received.length; i++) expect(received[i]).toBeLessThan(received[i - 1] as number)
		expect(received.at(-1)).toBe(-60)
	})
})
