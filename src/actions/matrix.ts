import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionEvent,
	type CompanionActionLearnContext,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import type { MatrixActionOptions, SetSelectedSourceOptions, SetSelectedTargetOptions } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { FeedbackId } from '../feedback.js'
import type EmberPlusInstance from '../index.js'
import {
	connectedSources,
	isMatrixNode,
	isNToN,
	loadedConnections,
	type MatrixInfo,
	type MatrixNode,
} from '../matrices.js'
import { chosenMatrix, NoSource, sourceOf, sourcesOf, targetOf } from '../matrixOptions.js'
import { EmberPlusState } from '../state.js'
import { resolvePath } from '../util.js'

const logger = createModuleLogger('Actions/Matrix')

type MatrixMethod = EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection']

/** What an action asks of a target: connect sources (Matrix Connect, Take), disconnect them, or set them (absolute) */
export type MatrixOperation = 'connect' | 'disconnect' | 'absolute'

/** A request to send: the library method, which gives the connection's operation, and the sources */
export interface MatrixRequest {
	method: 'matrixConnect' | 'matrixDisconnect' | 'matrixSetConnection'
	sources: number[]
}

/**
 * The request to send for an operation on a matrix's target. The Glow DTD has the operations connect and disconnect for
 * an N:N matrix only ("nToN only"), and absolute, the default, for any. So on any other matrix (1:N, the default, or
 * 1:1, where a target has one source) a connect goes as absolute with its source, the first of several (an expression
 * may give a list); and a disconnect as absolute with the target's sources less those given, once the matrix's
 * connections are loaded to tell (`connections`, see MatrixInfo.connectionsLoaded), or else as a disconnect. Undefined
 * for nothing to send there: a connect without a source, which absolute would make a disconnect, or a disconnect of a
 * source not connected to the target, which absolute would make the disconnect of another.
 */
export function matrixRequest(
	matrix: EmberModel.Matrix,
	connections: EmberModel.Connections | undefined,
	operation: MatrixOperation,
	target: number,
	sources: number[],
): MatrixRequest | undefined {
	if (operation === 'absolute') return { method: 'matrixSetConnection', sources }
	if (isNToN(matrix)) return { method: operation === 'connect' ? 'matrixConnect' : 'matrixDisconnect', sources }
	if (operation === 'connect')
		return sources.length ? { method: 'matrixSetConnection', sources: sources.slice(0, 1) } : undefined
	if (!connections) return { method: 'matrixDisconnect', sources }
	const connected = connections.get(target)?.sources ?? []
	if (!sources.some((source) => connected.includes(source))) return undefined
	return { method: 'matrixSetConnection', sources: connected.filter((source) => !sources.includes(source)) }
}

/**
 * Send an operation on a matrix's target, as matrixRequest makes it, without waiting for the provider's report.
 * Logs, rather than sends, a request with nothing to do.
 */
async function sendMatrixRequest(
	emberClient: EmberClient,
	info: MatrixInfo,
	node: MatrixNode,
	operation: MatrixOperation,
	target: number,
	sources: number[],
): Promise<void> {
	const { path } = info
	// The loaded matrix's connections; none for one looked up because it couldn't be loaded
	const connections = info.node === node ? loadedConnections(info) : undefined
	const request = matrixRequest(node.contents, connections, operation, target, sources)
	if (!request) {
		logger.debug(
			operation === 'connect'
				? `Matrix ${path}: no source to connect to target ${target}, so nothing was sent`
				: `Matrix ${path}: source ${sources.join(', ')} isn't connected to target ${target}, so nothing was sent`,
		)
		return
	}
	if (operation === 'connect' && request.sources.length < sources.length) {
		logger.debug(`Matrix ${path}: one source a target, so only the first of ${sources.join(', ')} was sent`)
	}
	logger.debug(`Matrix ${path}: ${request.method}, target ${target}, sources ${request.sources.join(', ')}`)
	handleMatrixReport(path, target, await emberClient[request.method](node, target, request.sources))
}

/**
 * A configured matrix's element: the one loaded on connecting, or else (it couldn't be loaded then) looked up now.
 * Only the lookup goes through the queue, as registerNewParameter does. Undefined for a path that holds no matrix.
 */
async function resolveMatrixNode(
	self: EmberPlusInstance,
	emberClient: EmberClient,
	state: EmberPlusState,
	queue: PQueue,
	info: MatrixInfo,
	signal?: AbortSignal,
): Promise<MatrixNode | undefined> {
	if (info.node) return info.node
	const cached = state.emberElement.get(info.path)
	if (isMatrixNode(cached)) return cached

	const node = await queue.add(async () => emberClient.getElementByPath(resolvePath(info.path)), { signal })
	if (isMatrixNode(node)) {
		// Not cached when a host change has replaced the client it came from
		if (self.isCurrentClient(emberClient)) state.emberElement.set(info.path, node)
		return node
	}

	return undefined
}

/**
 * Deal with the provider's report on a connection request, without waiting for it. A provider needn't report a
 * connection that changes nothing, such as a source already connected, so the response then times out; awaited, it
 * held the queue for the timeout and failed the action. The library rejects the response when the provider reports
 * the target locked: the connection was refused, so that is a warning.
 */
export function handleMatrixReport(matrix: string, target: number, request: Awaited<ReturnType<MatrixMethod>>): void {
	request.response?.then(
		() => logger.debug(`Matrix ${matrix}: target ${target} reported`),
		(e: unknown) => {
			const message = e instanceof Error ? e.message : String(e)
			if (message.endsWith(' is locked')) {
				logger.warn(`Matrix ${matrix}: target ${target} is locked, so the provider refused the connection`)
			} else if (message === 'Request timed out') {
				logger.debug(`Matrix ${matrix}: the provider reported no change on target ${target} (probably already set)`)
			} else {
				logger.debug(`Matrix ${matrix}: no report on target ${target}: ${message}`)
			}
		},
	)
}

/**
 * Matrix Connect, Disconnect and Set Connection: the chosen matrix's target, and its source or sources. The request is
 * made in the queue, from the matrix's connections as they are when it goes (see matrixRequest).
 */
export const doMatrixAction =
	(
		self: EmberPlusInstance,
		emberClient: EmberClient,
		operation: MatrixOperation,
		queue: PQueue,
		state: EmberPlusState,
	) =>
	async (action: CompanionActionEvent<MatrixActionOptions>, context: CompanionActionCallbackContext): Promise<void> => {
		const info = chosenMatrix(state, action.options.matrix)
		const target = targetOf(action.options, info)
		const sources = sourcesOf(action.options, info)

		const node = await resolveMatrixNode(self, emberClient, state, queue, info, context.signal)
		if (!node) {
			logger.warn(`Matrix ${info.path} not found or not a matrix`)
			return
		}

		await queue.add(async () => sendMatrixRequest(emberClient, info, node, operation, target, sources), {
			signal: context.signal,
		})
	}

/**
 * Learn a connection action's sources: those connected to the chosen target, as the matrix's connections were loaded
 * from the provider (see MatrixInfo.connectionsLoaded). A list for an N:N matrix's multi-select, the one source for any
 * other matrix's dropdown. A target with no source connected learns none, with `none` (Set Connection: an empty list,
 * or None), and otherwise nothing (Matrix Connect, which would have nothing to connect). Nothing is learned (undefined)
 * for a matrix that isn't configured or whose connections aren't loaded, or an invalid target. Returns only the
 * sources, so the target, and an expression in it, are kept.
 */
export const learnMatrixSources =
	(state: EmberPlusState, { none }: { none: boolean }) =>
	(
		action: CompanionActionEvent<MatrixActionOptions>,
		_context: CompanionActionLearnContext,
	): Partial<MatrixActionOptions> | undefined => {
		const info = state.matrices.get(action.options.matrix)
		if (!info) return undefined
		let target: number
		try {
			target = targetOf(action.options, info)
		} catch (e) {
			logger.debug(`Learn: ${e instanceof Error ? e.message : String(e)}`)
			return undefined
		}
		const sources = connectedSources(info, target)
		if (sources === undefined) {
			logger.debug(`Learn: matrix ${info.path}'s connections aren't loaded, so nothing was learned`)
			return undefined
		}
		if (sources.length === 0 && !none) {
			logger.debug(`Learn: matrix ${info.path} has no source connected to target ${target}, so nothing was learned`)
			return undefined
		}
		const learned: Partial<MatrixActionOptions> = {}
		learned[`sources_${info.key}`] = isNToN(info.node?.contents) ? sources : (sources[0] ?? NoSource)
		return learned
	}

/**
 * Connect the selected source to the selected target (see matrixRequest), then clear the selection, whether it worked
 * or not.
 */
export const doMatrixActionFunction = async function (
	self: EmberPlusInstance,
	emberClient: EmberClient,
	state: EmberPlusState,
	queue: PQueue,
	signal?: AbortSignal,
): Promise<void> {
	const { matrix, target, source } = state.selected
	const info = state.matrices.get(matrix)
	if (source === -1 || target === -1 || !info) return

	try {
		const node = await resolveMatrixNode(self, emberClient, state, queue, info, signal)
		if (!node) {
			logger.warn(`Matrix ${matrix} not found or not a matrix`)
			return
		}

		await queue.add(
			async () => {
				logger.debug(`Take on matrix ${matrix}: target ${target}, source ${source}`)
				await sendMatrixRequest(emberClient, info, node, 'connect', target, [source])
			},
			{ signal },
		)
	} catch (e) {
		logger.debug('Failed to doMatrixActionFunction: ' + e)
	} finally {
		// Reset selections regardless of success or failure
		state.clearSelection()
		self.checkFeedbacks(FeedbackId.TargetBackgroundSelected, FeedbackId.SourceBackgroundSelected, FeedbackId.Take)
	}
}

/**
 * Take, for when Auto-Take is off: connect the selected source to the selected target
 */
export const doTake =
	(self: EmberPlusInstance, emberClient: EmberClient, state: EmberPlusState, queue: PQueue) =>
	async (_action: CompanionActionEvent, context?: CompanionActionCallbackContext): Promise<void> => {
		const { matrix, target, source } = state.selected
		if (target !== -1 && source !== -1 && state.matrices.has(matrix)) {
			logger.debug(`TAKE: selected target ${target}, selected source ${source} on matrix ${matrix}`)
			await doMatrixActionFunction(self, emberClient, state, queue, context?.signal)
		} else {
			logger.debug('TAKE went wrong.')
		}
	}

/**
 * Clear the current selected Source and Target
 * @param self reference to the BaseInstance
 * @param state reference to the modules state
 */
export const doClear = (self: EmberPlusInstance, state: EmberPlusState) => (): void => {
	state.clearSelection()
	self.checkFeedbacks(
		FeedbackId.SourceBackgroundSelected,
		FeedbackId.TargetBackgroundSelected,
		FeedbackId.Take,
		FeedbackId.Clear,
	)
}

/**
 * Select a source of the matrix whose target is selected. With Auto-Take, the source is connected to the target.
 */
export const setSelectedSource =
	(self: EmberPlusInstance, emberClient: EmberClient, config: EmberPlusConfig, state: EmberPlusState, queue: PQueue) =>
	async (
		action: CompanionActionEvent<SetSelectedSourceOptions>,
		context?: CompanionActionCallbackContext,
	): Promise<void> => {
		const info = chosenMatrix(state, action.options.matrix)
		const source = sourceOf(action.options, info)
		if (info.path === state.selected.matrix) {
			state.selected.source = source
			logger.debug('Take is: ' + config.take)
			if (config.take) await doMatrixActionFunction(self, emberClient, state, queue, context?.signal)
			self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
			logger.debug(`setSelectedSource: ${source} on Matrix: ${info.path}`)
		} else {
			logger.warn(`setSelectedSource: matrix mismatch, expected ${state.selected.matrix} got ${info.path}`)
		}
	}

/**
 * Select a target of a matrix, clearing any source selected
 */
export const setSelectedTarget =
	(self: EmberPlusInstance, state: EmberPlusState) =>
	async (action: CompanionActionEvent<SetSelectedTargetOptions>): Promise<void> => {
		const info = chosenMatrix(state, action.options.matrix)
		const target = targetOf(action.options, info)
		state.selected = { matrix: info.path, target, source: -1 }
		self.checkFeedbacks(
			FeedbackId.SourceBackgroundSelected,
			FeedbackId.TargetBackgroundSelected,
			FeedbackId.Take,
			FeedbackId.Clear,
		)
		logger.debug(`setSelectedTarget: ${target} on Matrix: ${info.path}`)
	}
