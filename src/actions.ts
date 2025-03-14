import type {
	CompanionActionDefinition,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionActionInfo,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldTextInput,
	InstanceBase,
	CompanionInputFieldCheckbox,
	CompanionActionContext,
	CompanionOptionValues,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type PQueue from 'p-queue'
import type { EmberPlusConfig } from './config'
import { FeedbackId } from './feedback'
import type { EmberPlusInstance } from './index'
import { EmberPlusState } from './state'
import {
	calcRelativeNumber,
	checkNumberLimits,
	filterPathChoices,
	parseEscapeCharacters,
	resolveEventPath,
	resolvePath,
	substituteEscapeCharacters,
} from './util'

export interface setValueActionOptions extends CompanionOptionValues {
	path: string
	pathVar: string
	usePathVar: boolean
	value: string | number | boolean
	useVar?: boolean
	variable: boolean
	valueVar?: string
	relative?: boolean
	min?: string
	max?: string
	factor?: string
	toggle?: boolean
	parseEscapeChars?: boolean
}

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

const pathDropDown: CompanionInputFieldDropdown = {
	type: 'dropdown',
	label: 'Select registered path',
	id: 'path',
	choices: [],
	default: 'No paths configured!',
	allowCustom: true,
}

const pathString: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Path',
	id: 'pathVar',
	required: true,
	useVariables: { local: true },
	default: '',
	tooltip: `Path may be supplied in decimals: 1.2.3, text: path.to.ember.element, or with a descriptor and the decimals wrapped in brackets: path to ember element[1.2.3.4]`,
}
const usePathVar: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Path from String',
	id: 'usePathVar',
	default: false,
}

const pathInput: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Path',
	id: 'path',
	useVariables: { local: true },
	tooltip: `Path may be supplied in decimals: 1.2.3, text: path.to.ember.element, or with a descriptor and the decimals wrapped in brackets: path to ember element[1.2.3.4]`,
}

const minLimit: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Minimum',
	id: 'min',
	default: '-4294967295',
	useVariables: { local: true },
	tooltip: 'Relative action minimum value will be limited to this value',
}

const maxLimit: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Maximum',
	id: 'max',
	default: '4294967295',
	useVariables: { local: true },
	tooltip: 'Relative action maximum value will be limited to this value',
}

const relative: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Relative',
	id: 'relative',
	default: false,
	tooltip: 'Adjust value by this amount. Variable will be auto-created.',
}

const createVariable: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Auto Create Variable',
	id: 'variable',
	default: false,
}

const useVariable: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Use Variable?',
	id: 'useVar',
	default: false,
}

export const factorOpt: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Factor',
	id: 'factor',
	useVariables: { local: true },
	default: '1',
	tooltip: `Value will be multiplied by this field`,
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

const learnSetValueActionOptions =
	(state: EmberPlusState, type: EmberModel.ParameterType) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<setValueActionOptions | undefined> => {
		const path = await resolveEventPath(action, context)
		if (!state.parameters.has(path)) return undefined
		const emberPath = state.parameters.get(path)
		if (type !== emberPath?.parameterType) return undefined
		const options = action.options as setValueActionOptions
		switch (type) {
			case EmberModel.ParameterType.String:
				if (emberPath?.value !== null && emberPath?.value !== undefined) {
					options.value = substituteEscapeCharacters(emberPath.value.toString())
					options.parseEscapeChars = true
				}
				break
			case EmberModel.ParameterType.Boolean:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Boolean(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				break
			case EmberModel.ParameterType.Enum:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) {
					options.min = emberPath.minimum.toString()
				} else {
					options.min = '0'
				}

				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				break
			case EmberModel.ParameterType.Integer:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) options.min = emberPath.minimum.toString()
				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				if (emberPath?.factor !== null && emberPath?.factor !== undefined) {
					options.factor = emberPath.factor.toString()
					options.value = Number(options.value) / emberPath.factor
					options.valueVar = options.value.toString()
				} else if (emberPath?.value !== null && emberPath?.value !== undefined) {
					options.factor = '1'
				}
				break
			case EmberModel.ParameterType.Real:
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.value = Number(emberPath.value)
				if (emberPath?.value !== null && emberPath?.value !== undefined) options.valueVar = emberPath.value.toString()
				if (emberPath?.minimum !== null && emberPath?.minimum !== undefined) options.min = emberPath.minimum.toString()
				if (emberPath?.maximum !== null && emberPath?.maximum !== undefined) options.max = emberPath.maximum.toString()
				break
			default:
				return undefined
		}
		return options
	}

const setValue =
	(
		self: EmberPlusInstance,
		emberClient: EmberClient,
		type: EmberModel.ParameterType,
		state: EmberPlusState,
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const path = await resolveEventPath(action, context)
		if (action.options.variable || action.options.toggle || action.options.relative) {
			await self.registerNewParameter(path)
		}
		await queue
			.add(async () => {
				const node = await emberClient.getElementByPath(path)
				// TODO - do we handle not found?
				if (node && node.contents.type === EmberModel.ElementType.Parameter) {
					if (node.contents.parameterType === type) {
						if (
							node.contents?.access === EmberModel.ParameterAccess.None ||
							node.contents?.access === EmberModel.ParameterAccess.Read
						) {
							self.log('warn', `Can't write to ${path} insufficent permissions: ${node.contents.access}`)
							return
						}
						self.log('debug', 'Got node on ' + path)
						let value: string | number | boolean
						let factor: number
						switch (type) {
							case EmberModel.ParameterType.String:
								value = await context.parseVariablesInString(action.options['value']?.toString() ?? '')
								if (action.options['parseEscapeChars']) value = parseEscapeCharacters(value)
								break
							case EmberModel.ParameterType.Integer:
								factor = parseInt(await context.parseVariablesInString(action.options['factor']?.toString() ?? '1'))
								if (isNaN(factor)) factor = 1
								value = action.options['useVar']
									? Math.floor(
											Number(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? '')) *
												factor,
										)
									: Math.floor(Number(action.options['value']) * factor)
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										type,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? -4294967295,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case EmberModel.ParameterType.Real:
								value = action.options['useVar']
									? Number(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Number(action.options['value'])
								if (isNaN(value) || value > 4294967295 || value < -4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										type,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? -4294967295,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case EmberModel.ParameterType.Enum:
								value = action.options['useVar']
									? parseInt(await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''))
									: Math.floor(Number(action.options['value']))
								if (isNaN(value) || value > 4294967295) {
									return
								}
								if (action.options['relative']) {
									value = await calcRelativeNumber(
										value,
										path,
										action.options['min']?.toString() ?? '',
										action.options['max']?.toString() ?? '',
										type,
										context,
										state,
									)
								}
								value = checkNumberLimits(
									value,
									state.parameters.get(path)?.minimum ?? 0,
									state.parameters.get(path)?.maximum ?? 4294967295,
								)
								break
							case EmberModel.ParameterType.Boolean:
								if (action.options['toggle']) {
									value = !state.parameters.get(path)?.value
								} else if (action.options['useVar']) {
									switch (await context.parseVariablesInString(action.options['valueVar']?.toString() ?? '')) {
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
											value = Boolean(
												await context.parseVariablesInString(action.options['valueVar']?.toString() ?? ''),
											)
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
		if (action.options.variable || action.options.toggle || action.options.relative) {
			await self.registerNewParameter(await resolveEventPath(action, context))
		}
	}

const doMatrixAction =
	(
		self: InstanceBase<EmberPlusConfig>,
		emberClient: EmberClient,
		method: EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection'],
		queue: PQueue,
	) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const path = await resolvePath(context, action.options['path']?.toString() ?? '')
		self.log('debug', 'Get node ' + path)
		await queue
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
const doMatrixActionFunction = async function (
	self: InstanceBase<EmberPlusConfig>,
	emberClient: EmberClient,
	config: EmberPlusConfig,
	state: EmberPlusState,
	queue: PQueue,
): Promise<void> {
	self.log('debug', 'Get node ' + state.selected.matrix)
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
	async (action: CompanionActionEvent): Promise<void> => {
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
			await doMatrixActionFunction(self, emberClient, config, state, queue)
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
	async (action: CompanionActionEvent): Promise<void> => {
		if (action.options['source'] != -1 && Number(action.options['matrix']) == state.selected.matrix) {
			state.selected.source = Number(action.options['source'])
			self.log('debug', 'Take is: ' + config.take)
			if (config.take) await doMatrixActionFunction(self, emberClient, config, state, queue)
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
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Integer) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Integer).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
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
					useVariables: { local: true },
					default: '0',
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				relative,
				{
					...minLimit,
					isVisible: (options) => {
						return !!options.relative
					},
					tooltip: 'Relative action maximum value will be limited to this value. Value is not factored',
				},
				{
					...maxLimit,
					isVisible: (options) => {
						return !!options.relative
					},
					tooltip: 'Relative action maximum value will be limited to this value. Value is not factored',
				},
				factorOpt,
				{
					...createVariable,
					isVisible: (options) => {
						return !options.relative
					},
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Integer, state, queue),
			subscribe: registerParameter(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Integer),
		},
		[ActionId.SetValueReal]: {
			name: 'Set Value Real',
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Real) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Real).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
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
					useVariables: { local: true },
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				relative,
				{
					...minLimit,
					isVisible: (options) => {
						return !!options.relative
					},
				},
				{
					...maxLimit,
					isVisible: (options) => {
						return !!options.relative
					},
				},
				{
					...createVariable,
					isVisible: (options) => {
						return !options.relative
					},
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Real, state, queue),
			subscribe: registerParameter(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Real),
		},
		[ActionId.SetValueBoolean]: {
			name: 'Set Value Boolean',
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Boolean) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Boolean).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
				{
					type: 'checkbox',
					label: 'Toggle',
					id: 'toggle',
					default: false,
					tooltip: 'Variable will be auto-created.',
				},
				{
					type: 'checkbox',
					label: 'Value',
					id: 'value',
					default: false,
					isVisible: (options) => {
						return !options.useVar && !options.toggle
					},
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'valueVar',
					default: 'false',
					useVariables: { local: true },
					isVisible: (options) => {
						return !!options.useVar && !options.toggle
					},
				},
				{
					...useVariable,
					isVisible: (options) => {
						return !options.toggle
					},
				},
				{
					...createVariable,
					isVisible: (options) => {
						return !options.toggle
					},
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Boolean, state, queue),
			subscribe: registerParameter(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Boolean),
		},
		[ActionId.SetValueEnum]: {
			name: 'Set Value ENUM (as Integer)',
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Enum) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Enum).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
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
					useVariables: { local: true },
					default: '0',
					tooltip: 'Return an integer between 0 and 4294967295',
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVariable,
				relative,
				{
					...minLimit,
					default: '0',
					isVisible: (options) => {
						return !!options.relative
					},
				},
				{
					...maxLimit,
					isVisible: (options) => {
						return !!options.relative
					},
				},
				{
					...createVariable,
					isVisible: (options) => {
						return !options.relative
					},
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Enum, state, queue),
			subscribe: registerParameter(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Enum),
		},
		[ActionId.SetValueString]: {
			name: 'Set Value String',
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.String) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.String).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					useVariables: { local: true },
				},
				{
					type: 'checkbox',
					label: 'Parse escape characters',
					id: 'parseEscapeChars',
					default: true,
					tooltip: 'Parse escape characters such as \\r \\n \\t',
				},
				createVariable,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.String, state, queue),
			subscribe: registerParameter(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.String),
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
