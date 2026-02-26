import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetActionsList } from './actions.js'
import { type EmberPlusConfig, GetConfigFields } from './config.js'
import { GetPresetsList } from './presets.js'
import { FeedbackId, GetFeedbacksList } from './feedback.js'
import { EmberPlusState } from './state.js'
import { EmberClient, Model as EmberModel } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency
import { ElementType, ParameterType } from 'emberplus-connection/dist/model/index.js'
import type { TreeElement, EmberElement } from 'emberplus-connection/dist/model/index.js'
import type { EmberValue } from 'emberplus-connection/dist/types/index.js'
import { Logger, LoggerLevel } from './logger.js'
import { StatusManager } from './status.js'
import { UpgradeScripts } from './upgrades.js'
import {
	sanitiseVariableId,
	parseBonjourHost,
	hasConnectionChanged,
	recordParameterAction,
	parseParameterValue,
} from './util.js'
import { GetVariablesList } from './variables.js'
import PQueue from 'p-queue'
import { throttle, debounce } from 'es-toolkit'

const ReconnectInterval = 30000 //emberplus-connection destroys socket after 5 minutes
const FeedbackThrottleRate = 30

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
	private state: EmberPlusState = new EmberPlusState()
	private emberQueue: PQueue = new PQueue({ concurrency: 1, autoStart: true })
	private feedbacksToCheck: Set<string> = new Set<string>()
	private variableValueUpdates: CompanionVariableValues = {}
	private isRecordingActions: boolean = false
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	public logger: Logger = new Logger(this)

	// Override base types to make types stricter
	public checkFeedbacks(...feedbackTypes: FeedbackId[]): void {
		super.checkFeedbacks(...feedbackTypes)
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	public async init(config: EmberPlusConfig): Promise<void> {
		this.applyConfig(config)
		try {
			await this.setupEmberConnection()
			await this.finalizeSetup()
		} catch (e) {
			if (e instanceof Error) this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, e.message)
			else this.statusManager.updateStatus(InstanceStatus.UnknownError, `Failed to initalize ember client ${e}`)
		}
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: EmberPlusConfig): Promise<void> {
		const oldConfig = structuredClone(this.config)
		this.logger.debug('Old Config:\n', oldConfig)

		this.applyConfig(config)

		if (hasConnectionChanged(oldConfig, config)) {
			this.resetConnection()
			try {
				await this.setupEmberConnection()
				await this.finalizeSetup()
			} catch (e) {
				if (e instanceof Error) this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, e.message)
				else this.statusManager.updateStatus(InstanceStatus.UnknownError, `Failed to initalize ember client ${e}`)
			}
		}
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
		this.throttledReconnect.cancel()
		this.throttledFeedbackChecksVariableUpdates.cancel()
		this.debouncedUpdateActionFeedbackDefs.cancel()
		this.emberQueue.clear()
		this.destroyEmberClient()
		this.statusManager.destroy()
	}

	private applyConfig(config: EmberPlusConfig): void {
		this.config = config
		this.logger = new Logger(this, config.logging ?? LoggerLevel.Information)
		const [host, port] = parseBonjourHost(config)
		this.config.host = host
		this.config.port = port
		this.logger.debug('New Config:\n', this.config)
	}

	private resetConnection(): void {
		this.throttledFeedbackChecksVariableUpdates.cancel()
		this.emberQueue.clear()
		this.feedbacksToCheck.clear()
		this.debouncedUpdateActionFeedbackDefs.cancel()
		this.destroyEmberClient()
		this.variableValueUpdates = {}
		this.state = new EmberPlusState()
	}

	private async finalizeSetup(): Promise<void> {
		this.setupMatrices()
		this.setupMonitoredParams()
		this.updateCompanionBits({
			updateActions: true,
			updateFeedbacks: true,
			updatePresets: true,
			updateVariables: true,
		})
		await this.registerParameters()
	}

	/**
	 * Update defintions of actions, feedbacks, variables. Optionally presets
	 */

	public updateCompanionBits(
		options: updateCompanionBitsOptions = {
			updateActions: true,
			updateFeedbacks: true,
			updatePresets: false,
			updateVariables: true,
		},
	): void {
		if (options.updateActions)
			this.setActionDefinitions(GetActionsList(this, this.client, this.config, this.state, this.emberQueue))
		if (options.updateFeedbacks)
			this.setFeedbackDefinitions(GetFeedbacksList(this, this.client, this.config, this.state))
		if (options.updateVariables) this.setVariableDefinitions(GetVariablesList(this.state))
		if (options.updatePresets) this.setPresetDefinitions(GetPresetsList())
	}

	public debouncedUpdateActionFeedbackDefs = debounce(() => {
		this.updateCompanionBits()
	}, 500)

	private get client(): EmberClient {
		return this.emberClient
	}

	private throttledReconnect = throttle(
		() => {
			this.setupEmberConnection().catch(() => {})
		},
		ReconnectInterval,
		{ edges: ['trailing'] },
	)

	private destroyEmberClient(): void {
		if (this.emberClient !== undefined) {
			this.emberClient.removeAllListeners()
			this.emberClient.discard()
		}
	}

	private async setupEmberConnection(): Promise<void> {
		this.throttledReconnect.cancel()

		this.destroyEmberClient()

		if (!this.config.host) {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No Host')
			throw new Error('No host configured')
		}

		this.logger.info(`Connecting to ${this.config.host}:${this.config.port}`)
		this.statusManager.updateStatus(InstanceStatus.Connecting)

		return new Promise<void>((resolve, reject) => {
			const settledState = { settled: false }

			this.emberClient = new EmberClient(this.config.host!, this.config.port)

			this.setupEmberClientHandlers(resolve, reject, settledState)

			this.emberClient.connect().catch((e) => {
				this.handleConnectionFailure(e, reject, settledState)
			})
		})
	}

	private setupEmberClientHandlers(
		resolve: () => void,
		reject: (reason?: any) => void,
		settledState: { settled: boolean },
	): void {
		this.emberClient.on('error', (e) => {
			this.handleConnectionError(e, reject, settledState)
		})

		this.emberClient.on('connected', () => {
			this.handleConnected(resolve, reject, settledState)
		})

		this.emberClient.on('disconnected', () => {
			this.handleDisconnected()
		})
	}

	private handleConnectionError(error: any, reject: (reason?: any) => void, settledState: { settled: boolean }): void {
		this.logger.error('Connection Error', error)
		this.statusManager.updateStatus(InstanceStatus.ConnectionFailure)
		this.throttledReconnect()

		if (settledState.settled) return
		settledState.settled = true
		reject(error)
	}

	private handleConnected(
		resolve: () => void,
		reject: (reason?: any) => void,
		settledState: { settled: boolean },
	): void {
		this.throttledReconnect.cancel()
		this.logger.info(`Connected to ${this.config.host}:${this.config.port}`)

		void (async () => {
			try {
				const request = await this.emberClient.getDirectory(this.emberClient.tree)
				await request.response
				this.statusManager.updateStatus(InstanceStatus.Ok)

				if (!settledState.settled) {
					settledState.settled = true
					resolve()
				}
			} catch (e) {
				if (e instanceof Error) {
					this.logger.error('Failed to discover root or subscribe to path:', e)
					this.statusManager.updateStatus(InstanceStatus.UnknownWarning, e.toString())
				}

				await this.emberClient.disconnect()
				this.throttledReconnect()

				if (!settledState.settled) {
					settledState.settled = true
					reject(new Error(`Failed to discover root or subscribe to path: ${e}`))
				}
			}
		})()
	}

	private handleDisconnected(): void {
		this.statusManager.updateStatus(InstanceStatus.Connecting, 'Disconnected')
		this.logger.warn(`Disconnected from ${this.config.host}:${this.config.port}`)
		this.throttledReconnect()
	}

	private handleConnectionFailure(
		error: any,
		reject: (reason?: any) => void,
		settledState: { settled: boolean },
	): void {
		this.statusManager.updateStatus(InstanceStatus.ConnectionFailure)
		this.logger.error('Connection Failure:', error)
		this.throttledReconnect()

		if (settledState.settled) return
		settledState.settled = true
		reject(new Error(`Connection Failure: ${error}`))
	}

	private setupMatrices(): void {
		if (this.config.matricesString) {
			this.state.matrices = [
				...new Set<string>(
					this.config.matricesString
						.replaceAll('/', '.')
						.split(',')
						.map((s) => s.trim())
						.filter((s) => s !== ''),
				),
			]
		}

		this.state.selected.source = -1
		this.state.selected.target = -1
	}

	private setupMonitoredParams(): void {
		this.state.monitoredParameters = new Set<string>()
		if (this.config.monitoredParametersString) {
			const params = this.config.monitoredParametersString
				.replaceAll('/', '.')
				.split(',')
				.map((param) => param.trim())
				.filter((param) => param.length > 0)
				.sort()

			this.state.monitoredParameters = new Set(params)
		}
	}

	private async registerParameters() {
		this.logger.debug('Start parameter registration')
		for (const path of this.state.monitoredParameters ?? []) {
			if (path === '') continue
			this.logger.debug('Attempt to subscribe to', path)
			await this.emberQueue
				.add(async () => {
					try {
						const initial_node = await this.emberClient.getElementByPath(path, (node) => {
							this.handleChangedValue(path, node).catch((e) => this.logger.error('Error handling parameter', e))
						})
						if (initial_node) {
							this.logger.debug('Registered for path', path)
							this.state.updateParameterMap(path, initial_node)
							await this.handleChangedValue(path, initial_node)
						}
					} catch {
						this.logger.error('Failed to subscribe to path', path)
					}
				})
				.catch((e) => {
					this.logger.debug(`Failed to register parameter:`, e)
				})
		}
		this.debouncedUpdateActionFeedbackDefs()
	}

	public async registerNewParameter(
		path: string,
		createVar: boolean = true,
	): Promise<TreeElement<EmberElement> | undefined> {
		if (path === '') return undefined

		// Return cached element if already registered
		if (this.state.emberElement.has(path) && (this.state.monitoredParameters?.has(path) || !createVar)) {
			return this.state.emberElement.get(path)
		}

		return this.emberQueue
			.add(async () => {
				try {
					const node = await this.emberClient.getElementByPath(path, (updatedNode) => {
						this.handleChangedValue(path, updatedNode).catch((e) => this.logger.error('Error handling parameter', e))
					})

					if (!node || node.contents.type !== ElementType.Parameter) {
						return node
					}

					this.logger.debug('Registered for path', path)
					this.logger.console(path, ':', node.contents)

					if (createVar) {
						this.state.monitoredParameters.add(path)
					}

					this.state.updateParameterMap(path, node)
					this.updateCompanionBits({
						updateVariables: true,
						updateActions: false,
						updateFeedbacks: false,
						updatePresets: false,
					})
					this.debouncedUpdateActionFeedbackDefs()
					await this.handleChangedValue(path, node)

					return node
				} catch (e) {
					this.logger.error('Failed to subscribe to path', path, String(e))
					return undefined
				}
			})
			.catch((e) => {
				this.logger.debug('Failed to register parameter:', e)
				return undefined
			})
	}

	// Track whether actions are being recorded
	public handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}

	// Throttled feedback checks and variable updates for better efficiency in busy systems
	private throttledFeedbackChecksVariableUpdates = throttle(
		() => {
			if (this.feedbacksToCheck.size > 0) {
				this.checkFeedbacksById(...this.feedbacksToCheck.values())
				this.feedbacksToCheck.clear()
			}
			if (Object.keys(this.variableValueUpdates).length > 0) {
				this.setVariableValues(this.variableValueUpdates)
				this.variableValueUpdates = {}
			}
		},
		FeedbackThrottleRate,
		{ edges: ['leading', 'trailing'] },
	)

	public async handleChangedValue(path: string, node: TreeElement<EmberElement>): Promise<void> {
		if (node.contents.type !== ElementType.Parameter) return

		this.logger.debug('Got parameter value for', path, ':', node.contents.value ?? '')
		this.state.updateParameterMap(path, node)

		const paramType = node.contents.parameterType
		const { actionType, value } = parseParameterValue(path, node.contents, this.state)

		if (actionType === undefined) return

		this.updateFeedbacksAndVariables(path, paramType, value, node.contents.value)

		if (this.isRecordingActions) {
			recordParameterAction(path, actionType, value, this, this.state)
		}
	}

	private updateFeedbacksAndVariables(
		path: string,
		paramType: EmberModel.ParameterType,
		value: boolean | number | string,
		rawValue: EmberValue | undefined,
	): void {
		this.state.getFeedbacksByPath(path).forEach((fbId) => this.feedbacksToCheck.add(fbId))

		const varId = sanitiseVariableId(path)
		this.variableValueUpdates[varId] = value

		if (paramType === ParameterType.Integer && !this.config.factor) {
			this.variableValueUpdates[varId] = Number(rawValue)
		} else if (paramType === ParameterType.Enum) {
			this.variableValueUpdates[`${varId}_ENUM`] = this.state.getCurrentEnumValue(path)
		}

		this.throttledFeedbackChecksVariableUpdates()
	}
}

runEntrypoint(EmberPlusInstance, UpgradeScripts)
