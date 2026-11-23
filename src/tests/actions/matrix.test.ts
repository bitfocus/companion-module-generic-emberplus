import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import {
	doMatrixAction,
	doTake,
	learnMatrixConnectSources,
	setSelectedSource,
	setSelectedTarget,
	type MatrixOperation,
} from '../../actions/matrix.js'
import { EmberPlusState } from '../../state.js'
import { captureLogs } from '../logs.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other action tests do
vi.mock('../../actions.js', () => ({ ActionId: {} }))

const logs = captureLogs()

function makeSelf() {
	return { isCurrentClient: () => true, checkFeedbacks: vi.fn() } as any
}

function makeQueue() {
	return { add: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()) } as any
}

/** A client whose connection requests are sent, their responses `response` */
function makeClient(response: Promise<unknown> = Promise.resolve()) {
	const sent = () => vi.fn().mockResolvedValue({ sentOk: true, response })
	return {
		matrixConnect: sent(),
		matrixDisconnect: sent(),
		matrixSetConnection: sent(),
		getElementByPath: vi.fn(),
	}
}

/**
 * A configured matrix, 1.4, loaded, so the action needn't look it up: 1:N unless `fill` makes it otherwise. Connections
 * `fill` gives count as loaded, as the GetDirectory on the matrix loads them
 */
function makeState(fill: (matrix: EmberModel.MatrixImpl) => void = () => undefined, loaded = true) {
	const state = new EmberPlusState()
	state.setMatrixPaths(['1.4'])
	if (loaded) {
		const matrix = new EmberModel.MatrixImpl('router')
		fill(matrix)
		const info = state.matrices.get('1.4')!
		info.node = new EmberModel.NumberedTreeNodeImpl(4, matrix)
		info.connectionsLoaded = matrix.connections !== undefined
	}
	return state
}

const nToN = (matrix: EmberModel.MatrixImpl) => (matrix.matrixType = EmberModel.MatrixType.NToN)

// A dropdown's one source, as a 1:N matrix's sources field gives it
const action = { options: { matrix: '1.4', target_1_4: 2, sources_1_4: 5 } } as any
const ctx = { signal: new AbortController().signal } as any

/** Run a matrix action with the options given, returning the client it sent with */
async function run(
	operation: MatrixOperation,
	options: Record<string, unknown>,
	state = makeState(),
	client = makeClient(),
) {
	await doMatrixAction(makeSelf(), client as any, operation, makeQueue(), state)({ options } as any, ctx)
	// Let the response's handlers run
	await new Promise((resolve) => setImmediate(resolve))
	return client
}

/** Whether the client sent any connection request */
function sentAnything(client: ReturnType<typeof makeClient>): boolean {
	return [client.matrixConnect, client.matrixDisconnect, client.matrixSetConnection].some((m) => m.mock.calls.length)
}

describe('matrix actions', () => {
	it("sends the chosen matrix's target and source", async () => {
		const client = await run('absolute', action.options)
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }), 2, [5])
	})

	// An N:N matrix's sources come from its multi-select
	it('sends the sources of the multi-select, when the matrix has one', async () => {
		const client = await run('absolute', { matrix: '1.4', target_1_4: 2, sources_1_4: [3, 4] })
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [3, 4])
	})

	it('sends no source for None', async () => {
		const client = await run('absolute', { matrix: '1.4', target_1_4: 2, sources_1_4: -1 })
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [])
	})

	// A field in expression mode, upgraded from text with variables, gives the text
	it('reads sources an expression gave as comma separated text', async () => {
		const client = await run('absolute', { matrix: '1.4', target_1_4: '2', sources_1_4: ' 3, 4' })
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [3, 4])
	})

	it("reads only the chosen matrix's fields", async () => {
		const state = makeState()
		state.setMatrixPaths(['1.4', '1.5'])
		const options = { matrix: '1.4', target_1_4: 2, sources_1_4: 5, target_1_5: 8, sources_1_5: 9 }
		const client = await run('absolute', options, state)
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [5])
	})

	// The user's call: an upgraded path built from variables names no matrix, and the action fails until one is chosen
	it('fails for a matrix not in the module config', async () => {
		const client = makeClient()
		const done = run('connect', { matrix: '1.$(internal:custom_m)', target: 2 }, makeState(), client)
		await expect(done).rejects.toThrow('Matrix 1.$(internal:custom_m) is not one of the matrices in the module config')
		expect(sentAnything(client)).toBe(false)
	})

	// The provider showed it isn't a matrix, so it was left out: the config does list it
	it('says why a configured matrix is left out', async () => {
		const state = makeState()
		state.dropMatrix('1.4', 'was not found')
		const done = run('connect', action.options, state)
		await expect(done).rejects.toThrow(
			'Matrix 1.4 was not found on the provider, so it is left out until the next connection or config change',
		)
	})

	// The action's abort signal, so a cancelled action's lookup isn't sent (the shared CLAUDE.md)
	it("looks up a matrix with the action's abort signal", async () => {
		const client = makeClient()
		client.getElementByPath.mockResolvedValue(
			new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router')),
		)
		const queue = makeQueue()
		await doMatrixAction(makeSelf(), client as any, 'absolute', queue, makeState(undefined, false))(action, ctx)
		expect(queue.add.mock.calls.map((call: unknown[]) => call[1])).toEqual([
			{ signal: ctx.signal },
			{ signal: ctx.signal },
		])
	})

	// Not loaded on connecting (the provider didn't answer then): looked up now, through the queue
	it("looks up a matrix that couldn't be loaded", async () => {
		const node = new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router'))
		const client = makeClient()
		client.getElementByPath.mockResolvedValue(node)
		const state = makeState(undefined, false)
		await run('absolute', action.options, state, client)
		expect(client.getElementByPath).toHaveBeenCalledWith('1.4')
		expect(client.matrixSetConnection).toHaveBeenCalledWith(node, 2, [5])
		expect(state.emberElement.get('1.4')).toBe(node)
	})

	// A provider needn't report a connection that changes nothing. Awaited, the response held the queue for the
	// timeout, and the action failed with "Request timed out"
	it('finishes without waiting for the provider to report', async () => {
		const client = makeClient(new Promise(() => undefined))
		const done = doMatrixAction(makeSelf(), client as any, 'connect', makeQueue(), makeState())(action, ctx)
		await expect(done).resolves.toBeUndefined()
	})

	it('logs no report at debug level, not as a failure', async () => {
		await run('connect', action.options, makeState(), makeClient(Promise.reject(new Error('Request timed out'))))
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
		const locked = makeClient(Promise.reject(new Error('Matrix 1.4: target 2 is locked')))
		await run('connect', action.options, makeState(), locked)
		expect(logs).toHaveBeenCalledWith(
			'Actions/Matrix',
			'warn',
			'Matrix 1.4: target 2 is locked, so the provider refused the connection',
		)
	})

	// Ember+ gives targets as Integer32, and sources as path numbers the library holds to 2^31 - 1
	it.each([
		['a target above 2^31 - 1', { target_1_4: 2 ** 31, sources_1_4: 5 }, 'invalid target'],
		['a fractional target', { target_1_4: 1.5, sources_1_4: 5 }, 'invalid target'],
		['no target', { sources_1_4: 5 }, 'invalid target'],
		['a source above 2^31 - 1', { target_1_4: 2, sources_1_4: [5, 2 ** 31] }, 'invalid source'],
		['a source that is no number', { target_1_4: 2, sources_1_4: '5,x' }, 'invalid source: x'],
	])('refuses %s without sending', async (_name, options, error) => {
		const client = makeClient()
		await expect(run('absolute', { matrix: '1.4', ...options }, makeState(), client)).rejects.toThrow(error)
		expect(sentAnything(client)).toBe(false)
	})

	it('takes the largest target and source Ember+ allows', async () => {
		const max = 2 ** 31 - 1
		const client = await run('absolute', { matrix: '1.4', target_1_4: max, sources_1_4: max })
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), max, [max])
	})

	// The library refuses a target or source the matrix doesn't have before sending
	it('fails when the library refuses the request', async () => {
		const client = makeClient()
		client.matrixSetConnection.mockRejectedValue(new Error('Matrix 1.4 has no target 2'))
		await expect(run('absolute', action.options, makeState(), client)).rejects.toThrow('has no target 2')
	})
})

// The Glow DTD: connect and disconnect are "nToN only"; absolute, the default, is for any matrix
describe('the operation sent, by the matrix type', () => {
	it.each([
		['connect', 'matrixConnect'],
		['disconnect', 'matrixDisconnect'],
		['absolute', 'matrixSetConnection'],
	] as const)('sends an N:N matrix a %s as %s', async (operation, method) => {
		const client = await run(operation, { matrix: '1.4', target_1_4: 2, sources_1_4: [3, 4] }, makeState(nToN))
		expect(client[method]).toHaveBeenCalledWith(expect.anything(), 2, [3, 4])
		expect(Object.values(client).filter((m) => m.mock.calls.length)).toHaveLength(1)
	})

	it.each([
		['1:N', EmberModel.MatrixType.OneToN],
		['1:1', EmberModel.MatrixType.OneToOne],
		['no type (1:N)', undefined],
	])('sends a %s matrix a connect as absolute, with its source', async (_name, matrixType) => {
		const client = await run(
			'connect',
			action.options,
			makeState((m) => (m.matrixType = matrixType)),
		)
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [5])
		expect(client.matrixConnect).not.toHaveBeenCalled()
	})

	// Absolute without a source would disconnect the target
	it('sends a 1:N matrix nothing for a connect without a source', async () => {
		const client = await run('connect', { matrix: '1.4', target_1_4: 2, sources_1_4: -1 })
		expect(sentAnything(client)).toBe(false)
		expect(logs).toHaveBeenCalledWith('Actions/Matrix', 'debug', expect.stringContaining('nothing was sent'))
	})

	const connected = (matrix: EmberModel.MatrixImpl) =>
		(matrix.connections = EmberModel.connectionsOf([{ target: 2, sources: [5] }]))

	it('sends a 1:N matrix a disconnect of the connected source as absolute, without it', async () => {
		const client = await run('disconnect', action.options, makeState(connected))
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [])
		expect(client.matrixDisconnect).not.toHaveBeenCalled()
	})

	// Absolute would disconnect the source that is connected, which wasn't asked for
	it('sends a 1:N matrix nothing for a disconnect of a source not connected', async () => {
		const client = await run('disconnect', { matrix: '1.4', target_1_4: 2, sources_1_4: 6 }, makeState(connected))
		expect(sentAnything(client)).toBe(false)
		expect(logs).toHaveBeenCalledWith(
			'Actions/Matrix',
			'debug',
			"Matrix 1.4: source 6 isn't connected to target 2, so nothing was sent",
		)
	})

	it("sends a 1:N matrix a disconnect as one while its connections aren't loaded", async () => {
		const client = await run('disconnect', action.options)
		expect(client.matrixDisconnect).toHaveBeenCalledWith(expect.anything(), 2, [5])
	})

	// A report on another target, or a connect's reply, creates the library's connections before the GetDirectory on the
	// matrix has loaded them all: a target missing from them may have a source
	it('sends a 1:N matrix a disconnect as one while it has only the connections a report covered', async () => {
		const state = makeState((matrix) => (matrix.connections = EmberModel.connectionsOf([{ target: 7, sources: [1] }])))
		state.matrices.get('1.4')!.connectionsLoaded = false
		const client = await run('disconnect', action.options, state)
		expect(client.matrixDisconnect).toHaveBeenCalledWith(expect.anything(), 2, [5])
	})

	// An upgraded action's sources expression may give several; a 1:N target takes one
	it('sends a 1:N matrix only the first of several sources to connect', async () => {
		const client = await run('connect', { matrix: '1.4', target_1_4: 2, sources_1_4: '3,4' })
		expect(client.matrixSetConnection).toHaveBeenCalledWith(expect.anything(), 2, [3])
		expect(logs).toHaveBeenCalledWith('Actions/Matrix', 'debug', expect.stringContaining('only the first of 3, 4'))
	})

	// What is connected may change while the request waits in the queue
	it('decides from the connections as they are when the request goes', async () => {
		const state = makeState(connected)
		const client = makeClient()
		const queued: Array<() => Promise<unknown>> = []
		const queue = { add: vi.fn(async (fn: () => Promise<unknown>) => queued.push(fn)) }
		await doMatrixAction(makeSelf(), client as any, 'disconnect', queue as any, state)(action, ctx)
		state.matrices.get('1.4')!.node!.contents.connections = EmberModel.connectionsOf([{ target: 2, sources: [7] }])
		await queued[0]()
		expect(sentAnything(client)).toBe(false)
	})
})

describe("learning Matrix Connect's sources", () => {
	const learn = (options: Record<string, unknown>, state: EmberPlusState) =>
		learnMatrixConnectSources(state)({ options } as any, {} as any)
	const connectedTo2 =
		(...sources: number[]) =>
		(matrix: EmberModel.MatrixImpl) =>
			(matrix.connections = EmberModel.connectionsOf([
				{ target: 2, sources },
				{ target: 3, sources: [9] },
			]))

	it("learns a 1:N matrix's target's source, for its dropdown of one", () => {
		expect(learn({ matrix: '1.4', target_1_4: 2, sources_1_4: 1 }, makeState(connectedTo2(5)))).toEqual({
			sources_1_4: 5,
		})
	})

	it("learns an N:N matrix's target's sources, lowest first, for its multi-select", () => {
		const state = makeState((matrix) => {
			nToN(matrix)
			connectedTo2(7, 3)(matrix)
		})
		expect(learn({ matrix: '1.4', target_1_4: 2, sources_1_4: [] }, state)).toEqual({ sources_1_4: [3, 7] })
	})

	// Only the sources: the target, which may be an expression, is kept
	it('returns nothing but the sources', () => {
		const learned = learn({ matrix: '1.4', target_1_4: 3, sources_1_4: 1 }, makeState(connectedTo2(5)))
		expect(Object.keys(learned ?? {})).toEqual(['sources_1_4'])
		expect(learned).toEqual({ sources_1_4: 9 })
	})

	// A report on another target, or a connect's reply, creates the library's connections before the GetDirectory on the
	// matrix has loaded them all
	it("learns nothing while the matrix's connections aren't loaded", () => {
		const state = makeState(connectedTo2(5))
		state.matrices.get('1.4')!.connectionsLoaded = false
		expect(learn({ matrix: '1.4', target_1_4: 2 }, state)).toBeUndefined()
		expect(logs).toHaveBeenCalledWith('Actions/Matrix', 'debug', expect.stringContaining("aren't loaded"))
		expect(learn({ matrix: '1.4', target_1_4: 2 }, makeState(undefined, false))).toBeUndefined()
	})

	it('learns nothing for a target with no source connected', () => {
		expect(learn({ matrix: '1.4', target_1_4: 4, sources_1_4: 1 }, makeState(connectedTo2(5)))).toBeUndefined()
		expect(learn({ matrix: '1.4', target_1_4: 2 }, makeState(connectedTo2()))).toBeUndefined()
	})

	it('learns nothing for a matrix not configured, or an invalid target', () => {
		const state = makeState(connectedTo2(5))
		expect(learn({ matrix: '1.5', target_1_4: 2 }, state)).toBeUndefined()
		expect(learn({ matrix: '1.4', target_1_4: 2 ** 31 }, state)).toBeUndefined()
		expect(learn({ matrix: '1.4' }, state)).toBeUndefined()
	})
})

describe('XY selection', () => {
	it('selects a target of a matrix by its path, clearing the source', async () => {
		const state = makeState()
		state.selected = { matrix: '1.4', target: 1, source: 3 }
		await setSelectedTarget(makeSelf(), state)({ options: { matrix: '1.4', target_1_4: 7 } } as any)
		expect(state.selected).toEqual({ matrix: '1.4', target: 7, source: -1 })
	})

	it('selects a source of the matrix whose target is selected', async () => {
		const state = makeState()
		state.selected = { matrix: '1.4', target: 7, source: -1 }
		await setSelectedSource(
			makeSelf(),
			{} as any,
			{} as any,
			state,
			makeQueue(),
		)({
			options: { matrix: '1.4', source_1_4: 3 },
		} as any)
		expect(state.selected).toEqual({ matrix: '1.4', target: 7, source: 3 })
	})

	it('keeps the source of another matrix out of the selection', async () => {
		const state = makeState()
		state.setMatrixPaths(['1.4', '1.5'])
		state.selected = { matrix: '1.4', target: 7, source: -1 }
		await setSelectedSource(
			makeSelf(),
			{} as any,
			{} as any,
			state,
			makeQueue(),
		)({
			options: { matrix: '1.5', source_1_5: 3 },
		} as any)
		expect(state.selected.source).toBe(-1)
	})

	it.each([
		['a 1:N matrix', undefined, 'matrixSetConnection'],
		['an N:N matrix', nToN, 'matrixConnect'],
	] as const)(
		'connects the selected source to the selected target of %s on Take with %s, then clears the selection',
		async (_name, fill, method) => {
			const state = makeState(fill)
			state.selected = { matrix: '1.4', target: 7, source: 3 }
			const client = makeClient()
			await doTake(makeSelf(), client as any, state, makeQueue())({} as any)
			expect(client[method]).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }), 7, [3])
			expect(state.selected).toEqual({ matrix: '', target: -1, source: -1 })
		},
	)

	// The action's abort signal, so a cancelled Take's lookup and request aren't sent (the shared CLAUDE.md)
	it.each([
		['Take', async (client: any, queue: any, state: any) => doTake(makeSelf(), client, state, queue)({} as any, ctx)],
		[
			'Auto-Take',
			async (client: any, queue: any, state: any) =>
				setSelectedSource(
					makeSelf(),
					client,
					{ take: true } as any,
					state,
					queue,
				)({ options: { matrix: '1.4', source_1_4: 3 } } as any, ctx),
		],
	])("sends %s with the action's abort signal", async (_name, run) => {
		const state = makeState(undefined, false)
		state.selected = { matrix: '1.4', target: 7, source: 3 }
		const client = makeClient()
		client.getElementByPath.mockResolvedValue(
			new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router')),
		)
		const queue = makeQueue()
		await run(client, queue, state)
		expect(queue.add.mock.calls.map((call: unknown[]) => call[1])).toEqual([
			{ signal: ctx.signal },
			{ signal: ctx.signal },
		])
	})

	it.each([
		['source', setSelectedSource({} as any, {} as any, {} as any, makeState(), makeQueue())],
		['target', setSelectedTarget(makeSelf(), makeState())],
	])('refuses to select a %s above 2^31 - 1', async (key, select) => {
		await expect(select({ options: { matrix: '1.4', [`${key}_1_4`]: 2 ** 31 } } as any)).rejects.toThrow(
			`invalid ${key}`,
		)
	})
})
