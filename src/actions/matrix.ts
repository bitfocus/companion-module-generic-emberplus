import type { CompanionActionEvent, CompanionActionContext, InstanceBase } from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import type { EmberPlusConfig } from '../config'
import { FeedbackId } from '../feedback'
import type { EmberPlusInstance } from '../index'
import { EmberPlusState } from '../state'
import { resolvePath } from '../util'

export const doMatrixAction =
	(
		self: EmberPlusInstance,
		emberClient: EmberClient,
		method: EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection'],
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const path = await resolvePath(context, action.options['path']?.toString() ?? '')
		self.logger.debug('Get node ' + path)
		await queue
			.add(async () => {
				const node = await emberClient.getElementByPath(path)
				// TODO - do we handle not found?
				if (node && node.contents.type === EmberModel.ElementType.Matrix) {
					self.logger.debug('Got node on ' + path)
					const target = Number(action.options['target'])
					const sources = (action.options['sources'] as string)
						.split(',')
						.filter((v) => v !== '')
						.map((s) => Number(s))
					await method(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
				} else {
					self.logger.warn('Matrix ' + action.options['path'] + ' not found or not a parameter')
				}
			})
			.catch((e: any) => {
				self.logger.debug(`Failed to doMatrixAction: ${e.toString()}`)
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
	config: EmberPlusConfig,
	state: EmberPlusState,
	queue: PQueue,
): Promise<void> {
	self.logger.debug('Get node ' + state.selected.matrix)
	await queue
		.add(async () => {
			if (
				state.selected.source !== -1 &&
				state.selected.target !== -1 &&
				state.selected.matrix !== -1 &&
				config.matrices &&
				config.matrices[state.selected.matrix]
			) {
				emberClient
					.getElementByPath(config.matrices[state.selected.matrix])
					.then((node) => {
						// TODO - do we handle not found?
						if (node && node.contents.type === EmberModel.ElementType.Matrix) {
							self.logger.debug('Got node on ' + state.selected.matrix)
							const target = state.selected.target
							const sources = [state.selected.source]
							emberClient
								.matrixConnect(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
								.then((r) => self.logger.debug(r))
								.catch((r) => self.logger.debug(r))
						} else {
							self.logger.warn('Matrix ' + state.selected.matrix + ' not found or not a parameter')
						}
					})
					.catch((reason) => self.logger.debug(reason))
					.finally(() => {
						state.selected.matrix = state.selected.source = state.selected.target = -1
						self.checkFeedbacks(
							FeedbackId.TargetBackgroundSelected,
							FeedbackId.SourceBackgroundSelected,
							FeedbackId.Take,
						)
					})
			}
		})
		.catch((e: any) => {
			self.logger.debug(`Failed to doMatrixActionFunction: ${e.toString()}`)
		})
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
	(self: EmberPlusInstance, emberClient: EmberClient, config: EmberPlusConfig, state: EmberPlusState, queue: PQueue) =>
	async (action: CompanionActionEvent): Promise<void> => {
		if (
			state.selected.target !== -1 &&
			state.selected.source !== -1 &&
			state.selected.matrix !== -1 &&
			config.matrices
		) {
			self.logger.debug(
				'TAKE: selectedDest: ' +
					state.selected.target +
					' selected.source: ' +
					state.selected.source +
					' on matrix ' +
					Number(action.options['matrix']),
			)
			await doMatrixActionFunction(self, emberClient, config, state, queue)
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
		if (action.options['source'] != -1 && Number(action.options['matrix']) == state.selected.matrix) {
			state.selected.source = Number(action.options['source'])
			self.logger.debug('Take is: ' + config.take)
			if (config.take) await doMatrixActionFunction(self, emberClient, config, state, queue)
			self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
			self.logger.debug('setSelectedSource: ' + action.options['source'] + ' on Matrix: ' + state.selected.matrix)
		}
	}

/**
 * Selects a target on a specified matrix.
 * @param self reference to the BaseInstance
 * @param state reference to the state of the module
 */
export const setSelectedTarget =
	(self: EmberPlusInstance, state: EmberPlusState) =>
	(action: CompanionActionEvent): void => {
		if (action.options['target'] != -1) {
			state.selected.target = Number(action.options['target'])
			state.selected.matrix = Number(action.options['matrix'])
		}
		state.selected.source = -1
		self.checkFeedbacks(
			FeedbackId.SourceBackgroundSelected,
			FeedbackId.TargetBackgroundSelected,
			FeedbackId.Take,
			FeedbackId.Clear,
		)
		self.logger.debug('setSelectedTarget: ' + action.options['target'] + ' on Matrix: ' + state.selected.matrix)
	}
