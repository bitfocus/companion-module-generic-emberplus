import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionEvent,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import type { MatrixActionOptions, SetSelectedSourceOptions, SetSelectedTargetOptions } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { FeedbackId } from '../feedback.js'
import type EmberPlusInstance from '../index.js'
import { isSignalNumber } from '../ranges.js'
import { EmberPlusState } from '../state.js'
import { resolvePath } from '../util.js'

const logger = createModuleLogger('Actions/Matrix')

type MatrixNode = EmberTypes.ElementOf<EmberModel.Matrix>
type MatrixMethod = EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection']

function isMatrixNode(node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined): node is MatrixNode {
	return (
		node?.contents.type === EmberModel.ElementType.Matrix &&
		(EmberModel.isNumbered(node) || EmberModel.isQualified(node))
	)
}

/**
 * Resolves a matrix node, returning the cached element when one is already known.
 * Only the tree walk on a cache miss goes through the queue, mirroring registerNewParameter.
 */
async function resolveMatrixNode(
	self: EmberPlusInstance,
	emberClient: EmberClient,
	state: EmberPlusState,
	queue: PQueue,
	path: string,
): Promise<MatrixNode | undefined> {
	const cached = state.emberElement.get(path)
	if (isMatrixNode(cached)) return cached

	const node = await queue.add(async () => emberClient.getElementByPath(path))
	if (isMatrixNode(node)) {
		// Not cached when a host change has replaced the client it came from
		if (self.isCurrentClient(emberClient)) state.emberElement.set(path, node)
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

export const doMatrixAction =
	(self: EmberPlusInstance, emberClient: EmberClient, method: MatrixMethod, queue: PQueue, state: EmberPlusState) =>
	async (action: CompanionActionEvent<MatrixActionOptions>, context: CompanionActionCallbackContext): Promise<void> => {
		const path = resolvePath(action.options.path ?? '')
		const target = Number(action.options.target)
		const sources = (action.options.sources ?? '')
			.split(',')
			.filter((v) => v !== '')
			.map((s) => Number(s))

		if (!isSignalNumber(target)) {
			throw new Error(`Invalid target passed to matrix action: ${target}`)
		}
		const invalidSource = sources.find((source) => !isSignalNumber(source))
		if (invalidSource !== undefined) {
			throw new Error(`Invalid source passed to matrix action: ${invalidSource}`)
		}

		logger.debug('Get node ' + path)
		const node = await resolveMatrixNode(self, emberClient, state, queue, path)
		if (!node) {
			logger.warn('Matrix ' + path + ' not found or not a matrix')
			return
		}

		await queue.add(
			async () => {
				logger.debug('Got node on ' + path)
				handleMatrixReport(path, target, await method(node, target, sources))
			},
			{ signal: context.signal },
		)
	}

/**
 * Performs a connection on a specified matrix.
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 * @param queue reference to the PQueue of the module
 */
export const doMatrixActionFunction = async function (
	self: EmberPlusInstance,
	emberClient: EmberClient,
	state: EmberPlusState,
	queue: PQueue,
): Promise<void> {
	if (
		state.selected.source === -1 ||
		state.selected.target === -1 ||
		state.selected.matrix === -1 ||
		state.matrices.length <= state.selected.matrix
	) {
		return
	}

	const matrixIndex = state.selected.matrix
	const matrixPath = state.matrices[matrixIndex]
	const target = state.selected.target
	const sources = [state.selected.source]

	logger.debug('Get node ' + matrixIndex)
	try {
		const node = await resolveMatrixNode(self, emberClient, state, queue, matrixPath)
		if (!node) {
			logger.warn('Matrix ' + matrixIndex + ' not found or not a matrix')
			return
		}

		await queue.add(async () => {
			logger.debug('Got node on ' + matrixIndex)
			handleMatrixReport(matrixPath, target, await emberClient.matrixConnect(node, target, sources))
		})
	} catch (e) {
		logger.debug('Failed to doMatrixActionFunction: ' + e)
	} finally {
		// Reset selections regardless of success or failure
		state.selected.matrix = state.selected.source = state.selected.target = -1
		self.checkFeedbacks(FeedbackId.TargetBackgroundSelected, FeedbackId.SourceBackgroundSelected, FeedbackId.Take)
	}
}

/**
 * Gets called, when take is not on Auto-Take.
 * Performs a connect on the wanted matrix
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 * @param queue reference to the PQueue of the module
 */
export const doTake =
	(self: EmberPlusInstance, emberClient: EmberClient, state: EmberPlusState, queue: PQueue) =>
	async (_action: CompanionActionEvent): Promise<void> => {
		if (
			state.selected.target !== -1 &&
			state.selected.source !== -1 &&
			state.selected.matrix !== -1 &&
			state.matrices.length > state.selected.matrix
		) {
			logger.debug(
				'TAKE: selectedDest: ' +
					state.selected.target +
					' selected.source: ' +
					state.selected.source +
					' on matrix ' +
					state.selected.matrix,
			)
			await doMatrixActionFunction(self, emberClient, state, queue)
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
	state.selected.matrix = state.selected.source = state.selected.target = -1
	self.checkFeedbacks(
		FeedbackId.SourceBackgroundSelected,
		FeedbackId.TargetBackgroundSelected,
		FeedbackId.Take,
		FeedbackId.Clear,
	)
}

/**
 * Selects a source on a specific matrix.
 * When Auto-Take is enabled the source is routed to the selected target.
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 */
export const setSelectedSource =
	(self: EmberPlusInstance, emberClient: EmberClient, config: EmberPlusConfig, state: EmberPlusState, queue: PQueue) =>
	async (action: CompanionActionEvent<SetSelectedSourceOptions>): Promise<void> => {
		const source = Number(action.options.source)
		const matrix = Number(action.options.matrix)
		if (!isSignalNumber(source) || Number.isNaN(matrix) || matrix < 0 || matrix > 0xffffffff) {
			throw new Error(`Invalid source selection: Matrix: ${matrix}, Source: ${source}`)
		}
		if (matrix === state.selected.matrix) {
			state.selected.source = source
			logger.debug('Take is: ' + config.take)
			if (config.take) await doMatrixActionFunction(self, emberClient, state, queue)
			self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
			logger.debug('setSelectedSource: ' + source + ' on Matrix: ' + matrix)
		} else {
			logger.warn('setSelectedSource: matrix mismatch, expected ' + state.selected.matrix + ' got ' + matrix)
		}
	}

/**
 * Selects a target on a specified matrix.
 * @param self reference to the BaseInstance
 * @param state reference to the state of the module
 */
export const setSelectedTarget =
	(self: EmberPlusInstance, state: EmberPlusState) =>
	async (action: CompanionActionEvent<SetSelectedTargetOptions>): Promise<void> => {
		const target = Number(action.options.target)
		const matrix = Number(action.options.matrix)
		if (!isSignalNumber(target) || Number.isNaN(matrix) || matrix < 0 || matrix > 0xffffffff) {
			throw new Error(`Invalid target selection: Matrix: ${matrix}, Target: ${target}`)
		}
		state.selected.target = target
		state.selected.matrix = matrix
		state.selected.source = -1
		self.checkFeedbacks(
			FeedbackId.SourceBackgroundSelected,
			FeedbackId.TargetBackgroundSelected,
			FeedbackId.Take,
			FeedbackId.Clear,
		)
		logger.debug('setSelectedTarget: ' + target + ' on Matrix: ' + state.selected.matrix)
	}
