import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetActionsList, ActionId, type setValueActionOptions } from './actions'
import { type EmberPlusConfig, GetConfigFields } from './config'
import { GetPresetsList } from './presets'
import { FeedbackId, GetFeedbacksList } from './feedback'
import { EmberPlusState } from './state'
import { EmberClient, Model as EmberModel } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency
import { ElementType, ParameterType } from 'emberplus-connection/dist/model'
import type { TreeElement, EmberElement } from 'emberplus-connection/dist/model'
import { Logger, LoggerLevel } from './logger.js'
import { StatusManager } from './status.js'
import { UpgradeScripts } from './upgrades'
import { substituteEscapeCharacters } from './util'
import { GetVariablesList } from './variables'
import delay from 'delay'
import PQueue from 'p-queue'

const reconnectInterval: number = 300000 //emberplus-connection destroys socket after 5 minutes
const reconnectOnFailDelay: number = 10000 //reattempt delay when initial connection queries throw an error

interface updateCompanionBitsOptions {
	updateActions?: boolean
	updateFeedbacks?: boolean
	updatePresets?: boolean
	updateVariables?: boolean
}

/**
 * Companion instance class for generic EmBER+ Devices
 */
export class EmberPlusInstance extends InstanceBase<EmberPlusConfig> {
	private emberClient!: EmberClient
	private config!: EmberPlusConfig
	private state!: EmberPlusState
	private emberQueue!: PQueue
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined
	private isRecordingActions: boolean = false
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	public logger: Logger = new Logger(this)

	// Override base types to make types stricter
	public checkFeedbacks(...feedbackTypes: FeedbackId[]): void {
		super.checkFeedbacks(...feedbackTypes)
	}
	public checkFeedbacksById(...feedbackIds: string[]): void {
		super.checkFeedbacksById(...feedbackIds)
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	public async init(config: EmberPlusConfig): Promise<void> {
		this.config = config
		this.logger = new Logger(this, config.logging ?? LoggerLevel.Information)
		if (this.config.bonjourHost) {
			this.config.host = config.bonjourHost?.split(':')[0]
			this.config.port = Number(config.bonjourHost?.split(':')[1])
		}
		this.state = new EmberPlusState()
		this.emberQueue = new PQueue({ concurrency: 1 })
		this.setupEmberConnection()
		this.setupMatrices()
		this.setupMonitoredParams()
		this.updateCompanionBits({ updateActions: true, updateFeedbacks: true, updatePresets: true, updateVariables: true })
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: EmberPlusConfig): Promise<void> {
		const oldConfig = structuredClone(this.config)
		this.config = config
		this.logger = new Logger(this, config.logging)
		if (this.config.bonjourHost) {
			this.config.host = config.bonjourHost?.split(':')[0]
			this.config.port = Number(config.bonjourHost?.split(':')[1])
		}
		if (this.config.host !== oldConfig.host || this.config.port !== oldConfig.port) {
			this.setupEmberConnection()
			this.state = new EmberPlusState()
		}
		this.setupMatrices()
		this.setupMonitoredParams()
		this.updateCompanionBits({ updateActions: true, updateFeedbacks: true, updatePresets: true, updateVariables: true })
	}

	/**
	 * Creates the configuration fields for web config.
	 */
	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Clean up the instance before it is destroyed.
	 */
	public async destroy(): Promise<void> {
		this.reconnectTimerStop()
		this.emberQueue.clear()
		this.emberClient.discard()
		this.statusManager.destroy()
	}

	/**
	 * Update defintions of actions, feedbacks, variables. Optionally presets
	 */

	public updateCompanionBits(
		options: updateCompanionBitsOptions = {
			updateActions: false,
			updateFeedbacks: false,
			updatePresets: false,
			updateVariables: false,
		},
	): void {
		if (options.updateActions)
			this.setActionDefinitions(GetActionsList(this, this.client, this.config, this.state, this.emberQueue))
		if (options.updateFeedbacks)
			this.setFeedbackDefinitions(GetFeedbacksList(this, this.client, this.config, this.state))
		if (options.updateVariables) this.setVariableDefinitions(GetVariablesList(this.config, this.state))
		if (options.updatePresets) this.setPresetDefinitions(GetPresetsList())
	}

	private get client(): EmberClient {
		return this.emberClient
	}

	private reconnectTimerStart(): void {
		if (this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => this.setupEmberConnection(), reconnectInterval)
	}

	private reconnectTimerStop(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			delete this.reconnectTimer
		}
	}

	private setupEmberConnection(): void {
		this.emberQueue.clear()
		this.reconnectTimerStop()
		if (this.emberClient !== undefined) {
			this.emberClient.discard()
			//this.emberClient.removeAllListeners()
		}
		if (this.config.host === undefined || this.config.host === '') {
			this.logger.warn(`No Host`)
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No Host')
			return
		}
		this.logger.debug('Connecting ' + (this.config.host || '') + ':' + this.config.port)
		this.statusManager.updateStatus(InstanceStatus.Connecting)

		this.emberClient = new EmberClient(this.config.host || '', this.config.port)
		this.emberClient.on('error', (e) => {
			this.logger.error('Connection Error ' + e)
			this.statusManager.updateStatus(InstanceStatus.ConnectionFailure)
			this.reconnectTimerStart()
		})
		this.emberClient.on('connected', () => {
			this.reconnectTimerStop()
			this.logger.info(`Connected to ${this.config.host}:${this.config.port}`)
			Promise.resolve()
				.then(async () => {
					const request = await this.emberClient.getDirectory(this.emberClient.tree)
					await request.response
					await this.registerParameters()
					this.subscribeActions()
					this.subscribeFeedbacks()
					this.statusManager.updateStatus(InstanceStatus.Ok)
				})
				.catch(async (e) => {
					// get root
					this.logger.error('Failed to discover root or subscribe to path: ' + e)
					this.statusManager.updateStatus(InstanceStatus.UnknownWarning, e.toString())
					await this.emberClient.disconnect()
					await delay(reconnectOnFailDelay)
					this.setupEmberConnection()
				})
		})
		this.emberClient.on('disconnected', () => {
			this.statusManager.updateStatus(InstanceStatus.Connecting, 'Disconnected')
			this.logger.warn(`Disconnected from ${this.config.host}:${this.config.port}`)
			this.reconnectTimerStart()
		})
		this.reconnectTimerStart()
		this.emberClient.connect().catch((e) => {
			this.statusManager.updateStatus(InstanceStatus.ConnectionFailure)
			this.logger.error('Connection Failure: ' + e)
			this.reconnectTimerStart()
		})
	}

	private setupMatrices(): void {
		if (this.config.matricesString) {
			this.config.matrices = this.config.matricesString.split(',')
		}

		if (this.config.matrices) {
			this.state.selected.source = -1
		}
		if (this.config.matrices) {
			this.state.selected.target = -1
		}
	}

	private setupMonitoredParams(): void {
		if (this.config.monitoredParametersString) {
			this.config.monitoredParameters = this.config.monitoredParametersString.split(',')
		} else {
			this.config.monitoredParameters = []
		}
	}

	private async registerParameters() {
		this.logger.debug('Start parameter registration')
		for (const path of this.config.monitoredParameters ?? []) {
			if (path === '') break
			this.logger.debug('Attempt to subscribe to ' + path)
			await this.emberQueue
				.add(async () => {
					try {
						const initial_node = await this.emberClient.getElementByPath(path, (node) => {
							this.handleChangedValue(path, node).catch((e) => this.logger.error('Error handling parameter ' + e))
						})
						if (initial_node) {
							this.logger.debug('Registered for path "' + path + '"')
							this.state.updateParameterMap(path, initial_node)
							this.updateCompanionBits({ updateActions: true, updateFeedbacks: true, updateVariables: true })
							await this.handleChangedValue(path, initial_node)
						}
					} catch (e) {
						this.logger.error('Failed to subscribe to path "' + path + '": ' + e)
					}
				})
				.catch((e) => {
					this.logger.debug(`Failed to register parameter: ${e.toString()}`)
				})
		}
	}

	public async registerNewParameter(
		path: string,
		createVar: boolean = true,
	): Promise<TreeElement<EmberElement> | undefined> {
		if (path === '') return undefined
		if (this.state.emberElement.has(path)) {
			if ((this.config.monitoredParameters?.includes(path) === true && createVar) || !createVar)
				return this.state.emberElement.get(path)
		}
		return (await this.emberQueue
			.add(async (): Promise<TreeElement<EmberElement> | undefined> => {
				try {
					const initial_node = await this.emberClient.getElementByPath(path, (node) => {
						this.handleChangedValue(path, node).catch((e) => this.logger.error('Error handling parameter ' + e))
					})
					if (initial_node?.contents.type === ElementType.Parameter) {
						this.logger.debug('Registered for path "' + path + '"')
						if (this.config.monitoredParameters) {
							if (this.config.monitoredParameters?.includes(path) === false) {
								this.config.monitoredParameters.push(path)
							}
						} else {
							this.config.monitoredParameters = [path]
						}
						if (initial_node.contents.type == ElementType.Parameter) {
							this.state.updateParameterMap(path, initial_node)
							this.updateCompanionBits({ updateActions: true, updateFeedbacks: true, updateVariables: true })
							await this.handleChangedValue(path, initial_node)
						}
					}
					return initial_node
				} catch (e) {
					this.logger.error('Failed to subscribe to path "' + path + '": ' + e)
					return undefined
				}
			})
			.catch((e) => {
				this.logger.debug(`Failed to register parameter: ${e.toString()}`)
				return undefined
			})) as TreeElement<EmberElement> | undefined
	}

	// Track whether actions are being recorded
	public handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}
	public async handleChangedValue(path: string, node: TreeElement<EmberElement>): Promise<void> {
		if (node.contents.type == ElementType.Parameter) {
			this.logger.debug('Got parameter value for ' + path + ': ' + (node.contents.value ?? ''))
			let value: boolean | number | string
			let actionType: ActionId | undefined
			this.state.updateParameterMap(path, node)
			switch (node.contents.parameterType) {
				case EmberModel.ParameterType.Boolean:
					actionType = ActionId.SetValueBoolean
					value = node.contents.value as boolean
					break
				case EmberModel.ParameterType.Integer:
					actionType = ActionId.SetValueInt
					value = Number(node.contents.value) / (this.state.parameters.get(path)?.factor ?? 1)
					break
				case EmberModel.ParameterType.Real:
					actionType = ActionId.SetValueReal
					value = node.contents.value as number
					break
				case EmberModel.ParameterType.Enum:
					actionType = ActionId.SetValueEnum
					value = node.contents.value as number
					break
				case EmberModel.ParameterType.String:
					actionType = ActionId.SetValueString
					value = substituteEscapeCharacters(node.contents.value as string)
					break
				default:
					value = node.contents.value as string
			}
			if (this.state.getFeedbacksByPath(path).length > 0)
				this.checkFeedbacksById(...this.state.getFeedbacksByPath(path))
			const variableValues: CompanionVariableValues = {
				[path.replaceAll(/[# ]/gm, '_')]: value,
			}
			if (node.contents.parameterType === ParameterType.Integer && !this.config.factor) {
				variableValues[path.replaceAll(/[# ]/gm, '_')] = Number(node.contents.value)
			} else if (node.contents.parameterType === ParameterType.Enum) {
				variableValues[`${path.replaceAll(/[# ]/gm, '_')}_ENUM`] = this.state.getCurrentEnumValue(path)
			}
			this.setVariableValues(variableValues)

			if (this.isRecordingActions && actionType !== undefined) {
				const actOptions: setValueActionOptions = {
					path: path,
					pathVar: path,
					usePathVar: false,
					value: value,
					variable: true,
				}
				switch (actionType) {
					case ActionId.SetValueBoolean:
						actOptions.useVar = false
						actOptions.valueVar = value.toString()
						actOptions.toggle = false
						break
					case ActionId.SetValueEnum:
						actOptions.useVar = false
						actOptions.valueVar = value.toString()
						actOptions.relative = false
						actOptions.min = this.state.parameters.get(path)?.minimum?.toString() ?? '0'
						actOptions.max = this.state.parameters.get(path)?.maximum?.toString() ?? ''
						actOptions.asEnum = true
						actOptions.enumValue = this.state.getCurrentEnumValue(path)
						break
					case ActionId.SetValueInt:
						actOptions.useVar = false
						actOptions.valueVar = value.toString()
						actOptions.relative = false
						actOptions.min = this.state.parameters.get(path)?.minimum?.toString() ?? ''
						actOptions.max = this.state.parameters.get(path)?.maximum?.toString() ?? ''
						actOptions.factor = this.state.parameters.get(path)?.factor?.toString() ?? '1'
						break
					case ActionId.SetValueReal:
						actOptions.useVar = false
						actOptions.valueVar = value.toString()
						actOptions.relative = false
						actOptions.min = this.state.parameters.get(path)?.minimum?.toString() ?? ''
						actOptions.max = this.state.parameters.get(path)?.maximum?.toString() ?? ''
						break
					case ActionId.SetValueString:
						actOptions.parseEscapeChars = false
						break
					default:
						return
				}
				this.recordAction(
					{
						actionId: actionType,
						options: actOptions,
					},
					path,
				)
			}
		}
	}
}

runEntrypoint(EmberPlusInstance, UpgradeScripts)
