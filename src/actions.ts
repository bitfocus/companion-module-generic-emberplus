import type {
	CompanionActionDefinition,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionActionInfo,
	CompanionInputFieldNumber,
	CompanionInputFieldTextInput,
	InstanceBase,
	CompanionInputFieldCheckbox,
	CompanionActionContext,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import type { EmberPlusConfig } from './config'
import { FeedbackId } from './feedback'
import type { EmberPlusInstance } from './index'
import { EmberPlusState } from './state'
import type { CompanionCommonCallbackContext } from '@companion-module/base/dist/module-api/common'

export enum ActionId {
	SetValueInt = 'setValueInt',
	SetValueReal = 'setValueReal',
	SetValueString = 'setValueString',
	SetValueBoolean = 'setValueBoolean',
	SetValueEnum = 'setValueEnum',
	MatrixConnect = 'matrixConnect',
	MatrixDisconnect = 'matrixDisconnect',
	MatrixSetConnection = 'matrixSetConnection',
	Take = 'take',
	Clear = 'clear',
	SetSelectedSource = 'setSelectedSource',
	SetSelectedTarget = 'setSelectedTarget',
}

const pathInput: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Path',
	id: 'path',
	useVariables: true,
	tooltip: `Path may be supplied in decimals: 1.2.3, text: path.to.ember.element, or with a descriptor and the decimals wrapped in brackets: path to ember element[1.2.3.4]`,
}
const createVariable: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Auto Create Variable',
	id: 'variable',
	default: false,
	tooltip: 'Will not pickup variable change in path field',
}

const useVariable: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Use Variable?',
	id: 'useVar',
	default: false,
}

const matrixInputs: Array<CompanionInputFieldTextInput | CompanionInputFieldNumber> = [
	pathInput,
	{
		type: 'number',
		label: 'Target',
		id: 'target',
		required: true,
		min: 0,
		max: 0xffffffff,
		default: 0,
		step: 1,
	},
	{
		type: 'textinput',
		label: 'Sources',
		id: 'sources',
		regex: '/^((\\s*\\d+,)*(\\s*\\d+)$)|$/', // comma separated list
	},
]

export async function resolvePath(context: CompanionCommonCallbackContext, path: string): Promise<string> {
	const pathString: string = await context.parseVariablesInString(path)
	if (pathString.includes('[') && pathString.includes(']')) {
		return pathString.substring(pathString.indexOf('[') + 1, pathString.indexOf(']'))
	}
	return pathString
}

const setValue =
	(self: EmberPlusInstance, emberClient: EmberClient, type: EmberModel.ParameterType, queue: PQueue) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		queue
			.add(async () => {
				const path = await resolvePath(context, action.options['path']?.toString() ?? '')
				if (action.options.variable) {
					await self.registerNewParameter(path)
				}
				const node = await emberClient.getElementByPath(path)
				// TODO - do we handle not found?
				if (node && node.contents.type === EmberModel.ElementType.Parameter) {
					if (node.contents.parameterType === type) {
						self.log('debug', 'Got node on ' + path)
						let value: string | number | boolean
						switch (type) {
							case EmberModel.ParameterType.String:
								value = await self.parseVariablesInString(action.options['value']?.toString() ?? '')
								break
							case EmberModel.ParameterType.Integer:
								value = action.options['useVar']
									? parseInt(await self.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Math.floor(Number(action.options['value']))
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								break
							case EmberModel.ParameterType.Real:
								value = action.options['useVar']
									? Number(await self.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Number(action.options['value'])
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								break
							case EmberModel.ParameterType.Enum:
								value = action.options['useVar']
									? parseInt(await self.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Math.floor(Number(action.options['value']))
								if (isNaN(value) || value > 4294967295 || value < 0) {
									return
								}
								break
							case EmberModel.ParameterType.Boolean:
								if (action.options['useVar']) {
									switch (await self.parseVariablesInString(action.options['valueVar']?.toString() ?? '')) {
										case 'true':
										case 'on':
										case '1':
											value = true
											break
										case 'false':
										case 'off':
										case '0':
											value = false
											break
										default:
											value = Boolean(await self.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									}
								} else {
									value = Boolean(action.options['value'])
								}
								break
							default:
								return
						}
						const request = await emberClient.setValue(
							node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
							value,
							false,
						)
						request.response?.catch(() => null) // Ensure the response is 'handled'
					} else {
						self.log(
							'warn',
							'Node ' +
								action.options['path'] +
								' is not of type ' +
								type +
								' (is ' +
								node.contents.parameterType +
								')',
						)
					}
				} else {
					self.log('warn', 'Parameter ' + action.options['path'] + ' not found or not a parameter')
				}
			})
			.catch((e: any) => {
				self.log('debug', `Failed to set value: ${e.toString()}`)
			})
	}

const registerParameter =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionInfo, context: CompanionActionContext): Promise<void> => {
		if (action.options.variable) {
			await self.registerNewParameter(await resolvePath(context, action.options['path']?.toString() ?? ''))
		}
	}

const doMatrixAction =
	(
		self: InstanceBase<EmberPlusConfig>,
		emberClient: EmberClient,
		method: EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection'],
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent): Promise<void> => {
		const path = await resolvePath(self, action.options['path']?.toString() ?? '')
		self.log('debug', 'Get node ' + path)
		queue
			.add(async () => {
				const node = await emberClient.getElementByPath(path)
				// TODO - do we handle not found?
				if (node && node.contents.type === EmberModel.ElementType.Matrix) {
					self.log('debug', 'Got node on ' + path)
					const target = Number(action.options['target'])
					const sources = (action.options['sources'] as string)
						.split(',')
						.filter((v) => v !== '')
						.map((s) => Number(s))
					await method(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
				} else {
					self.log('warn', 'Matrix ' + action.options['path'] + ' not found or not a parameter')
				}
			})
			.catch((e: any) => {
				self.log('debug', `Failed to doMatrixAction: ${e.toString()}`)
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
const doMatrixActionFunction = function (
	self: InstanceBase<EmberPlusConfig>,
	emberClient: EmberClient,
	config: EmberPlusConfig,
	state: EmberPlusState,
	queue: PQueue,
) {
	self.log('debug', 'Get node ' + state.selected.matrix)
	queue
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
							self.log('debug', 'Got node on ' + state.selected.matrix)
							const target = state.selected.target
							const sources = [state.selected.source]
							emberClient
								.matrixConnect(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
								.then((r) => self.log('debug', String(JSON.stringify(r))))
								.catch((r) => self.log('debug', r))
						} else {
							self.log('warn', 'Matrix ' + state.selected.matrix + ' not found or not a parameter')
						}
					})
					.catch((reason) => self.log('debug', reason))
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
			self.log('debug', `Failed to doMatrixActionFunction: ${e.toString()}`)
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
const doTake =
	(
		self: InstanceBase<EmberPlusConfig>,
		emberClient: EmberClient,
		config: EmberPlusConfig,
		state: EmberPlusState,
		queue: PQueue,
	) =>
	(action: CompanionActionEvent): void => {
		if (
			state.selected.target !== -1 &&
			state.selected.source !== -1 &&
			state.selected.matrix !== -1 &&
			config.matrices
		) {
			self.log(
				'debug',
				'TAKE: selectedDest: ' +
					state.selected.target +
					' selected.source: ' +
					state.selected.source +
					' on matrix ' +
					Number(action.options['matrix']),
			)
			doMatrixActionFunction(self, emberClient, config, state, queue)
		} else {
			self.log('debug', 'TAKE went wrong.')
		}
	}

/**
 * Clear the current selected Source and Target
 * @param self reference to the BaseInstance
 * @param state reference to the modules state
 */
const doClear = (self: InstanceBase<EmberPlusConfig>, state: EmberPlusState) => (): void => {
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
const setSelectedSource =
	(
		self: InstanceBase<EmberPlusConfig>,
		emberClient: EmberClient,
		config: EmberPlusConfig,
		state: EmberPlusState,
		queue: PQueue,
	) =>
	(action: CompanionActionEvent): void => {
		if (action.options['source'] != -1 && Number(action.options['matrix']) == state.selected.matrix) {
			state.selected.source = Number(action.options['source'])
			self.log('debug', 'Take is: ' + config.take)
			if (config.take) doMatrixActionFunction(self, emberClient, config, state, queue)
			self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
			self.log('debug', 'setSelectedSource: ' + action.options['source'] + ' on Matrix: ' + state.selected.matrix)
		}
	}

/**
 * Selects a target on a specified matrix.
 * @param self reference to the BaseInstance
 * @param state reference to the state of the module
 */
const setSelectedTarget =
	(self: InstanceBase<EmberPlusConfig>, state: EmberPlusState) =>
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
		self.log('debug', 'setSelectedTarget: ' + action.options['target'] + ' on Matrix: ' + state.selected.matrix)
	}

export function GetActionsList(
	self: EmberPlusInstance,
	emberClient: EmberClient,
	config: EmberPlusConfig,
	state: EmberPlusState,
	queue: PQueue,
): CompanionActionDefinitions {
	const actions: { [id in ActionId]: CompanionActionDefinition | undefined } = {
		[ActionId.SetValueInt]: {
			name: 'Set Value Integer',
			options: [
				pathInput,
				{
					type: 'number',
					label: 'Value',
					id: 'value',
					required: true,
					min: -0xffffffff,
					max: 0xffffffff,
					default: 0,
					step: 1,
					isVisible: (options) => {
						return !options.useVar
					},
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'valueVar',
					required: true,
					useVariables: true,
					default: '0',
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Integer, queue),
			subscribe: registerParameter(self),
		},
		[ActionId.SetValueReal]: {
			name: 'Set Value Real',
			options: [
				pathInput,
				{
					type: 'number',
					label: 'Value',
					id: 'value',
					required: true,
					min: -0xffffffff,
					max: 0xffffffff,
					default: 0,
					step: 0.001, // TODO - don't want this at all preferably
					isVisible: (options) => {
						return !options.useVar
					},
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'valueVar',
					default: '0.0',
					useVariables: true,
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Real, queue),
			subscribe: registerParameter(self),
		},
		[ActionId.SetValueBoolean]: {
			name: 'Set Value Boolean',
			options: [
				pathInput,
				{
					type: 'checkbox',
					label: 'Value',
					id: 'value',
					default: false,
					isVisible: (options) => {
						return !options.useVar
					},
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'valueVar',
					default: 'false',
					useVariables: true,
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Boolean, queue),
			subscribe: async (action, context) => {
				if (action.options.variable) {
					await self.registerNewParameter(await resolvePath(context, action.options['path']?.toString() ?? ''))
				}
			},
		},
		[ActionId.SetValueEnum]: {
			name: 'Set Value ENUM (as Integer)',
			options: [
				pathInput,
				{
					type: 'number',
					label: 'Value',
					id: 'value',
					required: true,
					min: 0x00000000,
					max: 0xffffffff,
					default: 0,
					step: 1,
					isVisible: (options) => {
						return !options.useVar
					},
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'valueVar',
					required: true,
					useVariables: true,
					default: '0',
					tooltip: 'Return an integer between 0 and 4294967295',
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Enum, queue),
			subscribe: registerParameter(self),
		},
		[ActionId.SetValueString]: {
			name: 'Set Value String',
			options: [
				pathInput,
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					useVariables: true,
				},
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.String, queue),
			subscribe: registerParameter(self),
		},
		[ActionId.MatrixConnect]: {
			name: 'Matrix Connect',
			options: [...matrixInputs],
			callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixConnect(...args), queue),
		},
		[ActionId.MatrixDisconnect]: {
			name: 'Matrix Disconnect',
			options: [...matrixInputs],
			callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixDisconnect(...args), queue),
		},
		[ActionId.MatrixSetConnection]: {
			name: 'Matrix Set Connection',
			options: [...matrixInputs],
			callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixSetConnection(...args), queue),
		},
		[ActionId.Take]: {
			name: 'Take',
			options: [],
			callback: doTake(self, emberClient, config, state, queue),
		},
		[ActionId.Clear]: {
			name: 'Clear',
			options: [],
			callback: doClear(self, state),
		},
		[ActionId.SetSelectedSource]: {
			name: 'Set Selected Source',
			options: [
				{
					type: 'number',
					label: 'Select Matrix Number',
					id: 'matrix',
					required: true,
					min: -0,
					max: 0xffffffff,
					default: 0,
				},
				{
					type: 'number',
					label: 'Value',
					id: 'source',
					required: true,
					min: -0,
					max: 0xffffffff,
					default: 0,
				},
			],
			callback: setSelectedSource(self, emberClient, config, state, queue),
		},
		[ActionId.SetSelectedTarget]: {
			name: 'Set Selected Target',
			options: [
				{
					type: 'number',
					label: 'Select Matrix Number',
					id: 'matrix',
					required: true,
					min: -0,
					max: 0xffffffff,
					default: 0,
				},
				{
					type: 'number',
					label: 'Value',
					id: 'target',
					required: true,
					min: -0,
					max: 0xffffffff,
					default: 0,
				},
			],
			callback: setSelectedTarget(self, state),
		},
	}

	return actions
}
