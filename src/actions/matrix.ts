import type { CompanionActionEvent, CompanionActionContext, InstanceBase } from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import type { EmberPlusConfig } from '../config.js'
import { FeedbackId } from '../feedback.js'
import type { EmberPlusInstance } from '../index.js'
import { EmberPlusState } from '../state.js'
import { resolvePath } from '../util.js'

type MatrixNode = EmberModel.NumberedTreeNode<EmberModel.Matrix>
type MatrixMethod = EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection']

/**
 * Resolves a matrix node, returning the cached element when one is already known.
 * Only the tree walk on a cache miss goes through the queue, mirroring registerNewParameter.
 */
async function resolveMatrixNode(
	emberClient: EmberClient,
	state: EmberPlusState,
	queue: PQueue,
	path: string,
): Promise<MatrixNode | undefined> {
	const cached = state.emberElement.get(path)
	if (cached?.contents.type === EmberModel.ElementType.Matrix) {
		return cached as MatrixNode
	}

	const node = await queue.add(async () => emberClient.getElementByPath(path))
	if (node?.contents.type === EmberModel.ElementType.Matrix) {
		state.emberElement.set(path, node)
		return node as MatrixNode
	}

	return undefined
}

export const doMatrixAction =
	(self: EmberPlusInstance, emberClient: EmberClient, method: MatrixMethod, queue: PQueue, state: EmberPlusState) =>
	async (action: CompanionActionEvent, _context: CompanionActionContext): Promise<void> => {
		const path = resolvePath(action.options['path']?.toString() ?? '')
		const target = action.options['useVar']
			? Number.parseInt(action.options['targetVar']?.toString() ?? '')
			: Number(action.options['target'])
		const sources = (action.options['sources']?.toString() ?? '')
			.split(',')
			.filter((v) => v !== '')
			.map((s) => Number(s))

		if (Number.isNaN(target) || target < 0) {
			throw new Error(`Invalid target passed to matrix action: ${target}`)
		}

		self.logger.debug('Get node ' + path)
		const node = await resolveMatrixNode(emberClient, state, queue, path)
		if (!node) {
			self.logger.warn('Matrix ' + path + ' not found or not a matrix')
			return
		}

		await queue.add(async () => {
			self.logger.debug('Got node on ' + path)
			const request = await method(node, target, sources)
			await request.response
		})
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

	self.logger.debug('Get node ' + matrixIndex)
	try {
		const node = await resolveMatrixNode(emberClient, state, queue, matrixPath)
		if (!node) {
			self.logger.warn('Matrix ' + matrixIndex + ' not found or not a matrix')
			return
		}

		await queue.add(async () => {
			self.logger.debug('Got node on ' + matrixIndex)
			const request = await emberClient.matrixConnect(node, target, sources)
			await request.response
		})
	} catch (e) {
		self.logger.debug('Failed to doMatrixActionFunction: ' + e)
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
			self.logger.debug(
				'TAKE: selectedDest: ' +
					state.selected.target +
					' selected.source: ' +
					state.selected.source +
					' on matrix ' +
					state.selected.matrix,
			)
			await doMatrixActionFunction(self, emberClient, state, queue)
		} else {
			self.logger.debug('TAKE went wrong.')
		}
	}

/**
 * Clear the current selected Source and Target
 * @param self reference to the BaseInstance
 * @param state reference to the modules state
 */
export const doClear = (self: InstanceBase<EmberPlusConfig>, state: EmberPlusState) => (): void => {
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
	async (action: CompanionActionEvent): Promise<void> => {
		const source = action.options['useVar']
			? Number.parseInt(action.options['sourceVar']?.toString() ?? '')
			: Number(action.options['source'])
		const matrix = action.options['useVar']
			? Number.parseInt(action.options['matrixVar']?.toString() ?? '')
			: Number(action.options['matrix'])
		if (
			Number.isNaN(source) ||
			Number.isNaN(matrix) ||
			source < 0 ||
			matrix < 0 ||
			source > 0xffffffff ||
			matrix > 0xffffffff
		) {
			throw new Error(`Invalid source selection: Matrix: ${matrix}, Source: ${source}`)
		}
		if (matrix === state.selected.matrix) {
			state.selected.source = source
			self.logger.debug('Take is: ' + config.take)
			if (config.take) await doMatrixActionFunction(self, emberClient, state, queue)
			self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
			self.logger.debug('setSelectedSource: ' + source + ' on Matrix: ' + matrix)
		} else {
			self.logger.warn('setSelectedSource: matrix mismatch, expected ' + state.selected.matrix + ' got ' + matrix)
		}
	}

/**
 * Selects a target on a specified matrix.
 * @param self reference to the BaseInstance
 * @param state reference to the state of the module
 */
export const setSelectedTarget =
	(self: EmberPlusInstance, state: EmberPlusState) =>
	async (action: CompanionActionEvent): Promise<void> => {
		const target = action.options['useVar']
			? Number.parseInt(action.options['targetVar']?.toString() ?? '')
			: Number(action.options['target'])
		const matrix = action.options['useVar']
			? Number.parseInt(action.options['matrixVar']?.toString() ?? '')
			: Number(action.options['matrix'])
		if (
			Number.isNaN(target) ||
			Number.isNaN(matrix) ||
			target < 0 ||
			matrix < 0 ||
			target > 0xffffffff ||
			matrix > 0xffffffff
		) {
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
		self.logger.debug('setSelectedTarget: ' + target + ' on Matrix: ' + state.selected.matrix)
	}
