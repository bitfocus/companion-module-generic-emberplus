import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { doMatrixAction, setSelectedSource, setSelectedTarget } from '../../actions/matrix.js'
import { EmberPlusState } from '../../state.js'
import { captureLogs } from '../logs.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other action tests do
vi.mock('../../actions.js', () => ({ ActionId: {} }))

const logs = captureLogs()

function makeSelf() {
	return { isCurrentClient: () => true } as any
}

function makeQueue() {
	return { add: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()) } as any
}

/** A matrix in the state, so the action needn't look it up */
function makeState() {
	const state = new EmberPlusState()
	state.emberElement.set('1.4', new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router')))
	return state
}

const action = { options: { path: '1.4', target: 2, sources: '5' } } as any
const ctx = { signal: new AbortController().signal } as any

async function connectWith(response: Promise<unknown>) {
	const self = makeSelf()
	const method = vi.fn().mockResolvedValue({ sentOk: true, response })
	await doMatrixAction(self, {} as any, method, makeQueue(), makeState())(action, ctx)
	// Let the response's handlers run
	await new Promise((resolve) => setImmediate(resolve))
	return { self, method }
}

describe('matrix actions', () => {
	it('sends the connection for the target and sources', async () => {
		const { method } = await connectWith(Promise.resolve())
		expect(method).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }), 2, [5])
	})

	// A provider needn't report a connection that changes nothing. Awaited, the response held the queue for the
	// timeout, and the action failed with "Request timed out"
	it('finishes without waiting for the provider to report', async () => {
		const self = makeSelf()
		const never = new Promise(() => undefined)
		const method = vi.fn().mockResolvedValue({ sentOk: true, response: never })
		const done = doMatrixAction(self, {} as any, method, makeQueue(), makeState())(action, ctx)
		await expect(done).resolves.toBeUndefined()
	})

	it('logs no report at debug level, not as a failure', async () => {
		await connectWith(Promise.reject(new Error('Request timed out')))
		expect(logs).toHaveBeenCalledWith(
			'Actions/Matrix',
			'debug',
			expect.stringContaining('reported no change on target 2'),
		)
		expect(logs).not.toHaveBeenCalledWith('Actions/Matrix', 'warn', expect.anything())
		expect(logs).not.toHaveBeenCalledWith('Actions/Matrix', 'error', expect.anything())
	})

	// Library 0.5.0 rejects the response when the provider reports the target locked
	it('warns when the provider reports the target locked', async () => {
		await connectWith(Promise.reject(new Error('Matrix 1.4: target 2 is locked')))
		expect(logs).toHaveBeenCalledWith(
			'Actions/Matrix',
			'warn',
			'Matrix 1.4: target 2 is locked, so the provider refused the connection',
		)
	})

	// Ember+ gives targets as Integer32, and sources as path numbers the library holds to 2^31 - 1
	it.each([
		['a target above 2^31 - 1', { target: 2 ** 31, sources: '5' }, 'Invalid target'],
		['a fractional target', { target: 1.5, sources: '5' }, 'Invalid target'],
		['a source above 2^31 - 1', { target: 2, sources: `5,${2 ** 31}` }, 'Invalid source'],
		['a source that is no number', { target: 2, sources: '5,x' }, 'Invalid source'],
	])('refuses %s without sending', async (_name, options, error) => {
		const method = vi.fn()
		const run = doMatrixAction(
			makeSelf(),
			{} as any,
			method,
			makeQueue(),
			makeState(),
		)({ options: { path: '1.4', ...options } } as any, ctx)
		await expect(run).rejects.toThrow(error)
		expect(method).not.toHaveBeenCalled()
	})

	it('takes the largest target and source Ember+ allows', async () => {
		const method = vi.fn().mockResolvedValue({ sentOk: true, response: Promise.resolve() })
		const max = 2 ** 31 - 1
		await doMatrixAction(
			makeSelf(),
			{} as any,
			method,
			makeQueue(),
			makeState(),
		)({ options: { path: '1.4', target: max, sources: `${max}` } } as any, ctx)
		expect(method).toHaveBeenCalledWith(expect.anything(), max, [max])
	})

	it.each([
		['source', setSelectedSource({} as any, {} as any, {} as any, new EmberPlusState(), makeQueue())],
		['target', setSelectedTarget(makeSelf(), new EmberPlusState())],
	])('refuses to select a %s above 2^31 - 1', async (key, select) => {
		await expect(select({ options: { matrix: 0, [key]: 2 ** 31 } } as any)).rejects.toThrow(`Invalid ${key}`)
	})

	// The library refuses a target or source the matrix doesn't have before sending
	it('fails when the library refuses the request', async () => {
		const self = makeSelf()
		const method = vi.fn().mockRejectedValue(new Error('Matrix 1.4 has no target 2'))
		const run = doMatrixAction(self, {} as any, method, makeQueue(), makeState())(action, ctx)
		await expect(run).rejects.toThrow('has no target 2')
	})
})
