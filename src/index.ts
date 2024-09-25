import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import type { SomeCompanionConfigField } from '@companion-module/base'
import { GetActionsList, ActionId } from './actions'
import { type EmberPlusConfig, GetConfigFields } from './config'
import { GetPresetsList } from './presets'
import { FeedbackId, GetFeedbacksList } from './feedback'
import { EmberPlusState } from './state'
import { EmberClient, Model as EmberModel } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency
import { ElementType } from 'emberplus-connection/dist/model'
import type { TreeElement, EmberElement } from 'emberplus-connection/dist/model'
import { GetVariablesList } from './variables'
import delay from 'delay'
import PQueue from 'p-queue'

const reconnectInterval: number = 300000 //emberplus-connection destroys socket after 5 minutes
const reconnectOnFailDelay: number = 10000 //reattempt delay when initial connection queries throw an error

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

	// Override base types to make types stricter
	public checkFeedbacks(...feedbackTypes: string[]): void {
		// todo - arg should be of type FeedbackId
		super.checkFeedbacks(...feedbackTypes)
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	public async init(config: EmberPlusConfig): Promise<void> {
		this.config = config
		if (this.config.bonjourHost) {
			this.config.host = config.bonjourHost?.split(':')[0]
			this.config.port = Number(config.bonjourHost?.split(':')[1])
		}
		this.state = new EmberPlusState()
		this.emberQueue = new PQueue({ concurrency: 1 })
		this.setupEmberConnection()
		this.setupMatrices()
		this.setupMonitoredParams()

		this.updateCompanionBits(true)
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: EmberPlusConfig): Promise<void> {
		this.config = config
		if (this.config.bonjourHost) {
			this.config.host = config.bonjourHost?.split(':')[0]
			this.config.port = Number(config.bonjourHost?.split(':')[1])
		}
		//this.emberClient.discard()
		//this.emberClient.removeAllListeners()

		this.setupEmberConnection()
		this.setupMatrices()
		this.setupMonitoredParams()
		this.updateCompanionBits(true)
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
	}

	private updateCompanionBits(updateAll: boolean): void {
		this.setFeedbackDefinitions(GetFeedbacksList(this, this.client, this.config, this.state))
		this.setVariableDefinitions(GetVariablesList(this.config))
		if (!updateAll) return
		this.setActionDefinitions(GetActionsList(this, this.client, this.config, this.state, this.emberQueue))
		this.setPresetDefinitions(GetPresetsList())
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
			this.log('warn', `No Host`)
			this.updateStatus(InstanceStatus.BadConfig, 'No Host')
			return
		}
		this.log('debug', 'Connecting ' + (this.config.host || '') + ':' + this.config.port)
		this.updateStatus(InstanceStatus.Connecting)

		this.emberClient = new EmberClient(this.config.host || '', this.config.port)
		this.emberClient.on('error', (e) => {
			this.log('error', 'Connection Error ' + e)
			this.updateStatus(InstanceStatus.UnknownError)
			this.reconnectTimerStart()
		})
		this.emberClient.on('connected', () => {
			this.reconnectTimerStop()
			this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
			Promise.resolve()
				.then(async () => {
					const request = await this.emberClient.getDirectory(this.emberClient.tree)
					await request.response
					await this.registerParameters()
					this.subscribeActions()
					this.subscribeFeedbacks()
					this.updateStatus(InstanceStatus.Ok)
				})
				.catch(async (e) => {
					// get root
					this.log('error', 'Failed to discover root or subscribe to path: ' + e)
					this.updateStatus(InstanceStatus.UnknownWarning, e.toString())
					await this.emberClient.disconnect()
					await delay(reconnectOnFailDelay)
					this.setupEmberConnection()
				})
		})
		this.emberClient.on('disconnected', () => {
			this.updateStatus(InstanceStatus.Connecting, 'Disconnected')
			this.log('warn', `Disconnected from ${this.config.host}:${this.config.port}`)
			this.reconnectTimerStart()
		})
		this.reconnectTimerStart()
		this.emberClient.connect().catch((e) => {
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this.log('error', 'Connection Failure: ' + e)
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
		}
	}

	private async registerParameters() {
		this.log('debug', 'Start parameter registration')
		for (const path of this.config.monitoredParameters ?? []) {
			this.log('debug', 'Attempt to subscribe to ' + path)
			this.emberQueue
				.add(async () => {
					try {
						const initial_node = await this.emberClient.getElementByPath(path, (node) => {
							this.handleChangedValue(path, node).catch((e) => this.log('error', 'Error handling parameter ' + e))
						})
						if (initial_node) {
							this.log('debug', 'Registered for path "' + path + '"')
							await this.handleChangedValue(path, initial_node)
						}
					} catch (e) {
						this.log('error', 'Failed to subscribe to path "' + path + '": ' + e)
					}
				})
				.catch((e) => {
					this.log('debug', `Failed to register parameter: ${e.toString()}`)
				})
		}
	}

	public async registerNewParameter(path: string): Promise<void> {
		if (this.config.monitoredParameters?.includes(path) === true) return
		this.emberQueue
			.add(async () => {
				try {
					const initial_node = await this.emberClient.getElementByPath(path, (node) => {
						this.handleChangedValue(path, node).catch((e) => this.log('error', 'Error handling parameter ' + e))
					})
					if (initial_node) {
						this.log('debug', 'Registered for path "' + path + '"')
						if (this.config.monitoredParameters) {
							this.config.monitoredParameters.push(path)
							this.updateCompanionBits(false)
						}
						await this.handleChangedValue(path, initial_node)
					}
				} catch (e) {
					this.log('error', 'Failed to subscribe to path "' + path + '": ' + e)
				}
			})
			.catch((e) => {
				this.log('debug', `Failed to register parameter: ${e.toString()}`)
			})
	}
	// Track whether actions are being recorded
	public handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}
	public async handleChangedValue(path: string, node: TreeElement<EmberElement>): Promise<void> {
		if (node.contents.type == ElementType.Parameter) {
			this.log('debug', 'Got parameter value for ' + path + ': ' + (node.contents.value?.toString() ?? ''))
			this.state.parameters.set(path, node.contents.value?.toString() ?? '')
			this.checkFeedbacks(FeedbackId.Parameter, FeedbackId.String)

			this.setVariableValues(Object.fromEntries(this.state.parameters.entries()))
			if (this.isRecordingActions) {
				let actionType: ActionId
				let actionValue: number | boolean | string
				if (node.contents.parameterType === EmberModel.ParameterType.Integer) {
					actionType = ActionId.SetValueInt
					actionValue = Number(node.contents.value)
					if (isNaN(actionValue)) return
				} else if (node.contents.parameterType === EmberModel.ParameterType.Boolean) {
					actionType = ActionId.SetValueBoolean
					actionValue = !!node.contents.value
				} else if (node.contents.parameterType === EmberModel.ParameterType.Enum) {
					actionType = ActionId.SetValueEnum
					actionValue = Number(node.contents.value)
					if (isNaN(actionValue)) return
				} else if (node.contents.parameterType === EmberModel.ParameterType.Real) {
					actionType = ActionId.SetValueReal
					actionValue = Number(node.contents.value)
					if (isNaN(actionValue)) return
				} else if (node.contents.parameterType === EmberModel.ParameterType.String) {
					actionType = ActionId.SetValueString
					actionValue = node.contents.value?.toString() ?? ''
				} else {
					return
				}
				this.recordAction(
					{
						actionId: actionType,
						options: { path: path, value: actionValue },
					},
					`${path}`,
				)
			}
		}
	}
}

runEntrypoint(EmberPlusInstance, [])
