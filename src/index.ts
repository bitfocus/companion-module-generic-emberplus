import { InstanceBase, InstanceStatus, SomeCompanionConfigField, runEntrypoint } from '@companion-module/base'
import { GetActionsList } from './actions'
import { EmberPlusConfig, GetConfigFields } from './config'
import { GetPresetsList } from './presets'
import { FeedbackId, GetFeedbacksList } from './feedback'
import { EmberPlusState } from './state'
import { EmberClient } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency
import { ElementType, TreeElement, EmberElement } from 'emberplus-connection/dist/model'

/**
 * Companion instance class for generic EmBER+ Devices
 */
class EmberPlusInstance extends InstanceBase<EmberPlusConfig> {
  private emberClient!: EmberClient
  private config!: EmberPlusConfig
  private state!: EmberPlusState

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
    this.state = new EmberPlusState()

    this.setupEmberConnection()
    this.setupMatrices()
    this.setupFeedbackParams()

    this.updateCompanionBits()
  }

  /**
   * Process an updated configuration array.
   */
  public async configUpdated(config: EmberPlusConfig): Promise<void> {
    this.config = config

    this.emberClient.discard()
    this.emberClient.removeAllListeners()

    this.setupEmberConnection()
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
    this.emberClient.discard()
  }

  private updateCompanionBits(): void {
    this.setActionDefinitions(GetActionsList(this, this.client, this.config, this.state))
    this.setFeedbackDefinitions(GetFeedbacksList(this, this.client, this.config, this.state))
    this.setPresetDefinitions(GetPresetsList())
  }

  private get client(): EmberClient {
    return this.emberClient
  }

  private setupEmberConnection(): void {
    this.log('debug', 'connecting ' + (this.config.host || '') + ':' + this.config.port)
    this.updateStatus(InstanceStatus.Connecting)

    this.emberClient = new EmberClient(this.config.host || '', this.config.port)
    this.emberClient.on('error', (e) => {
      this.log('error', 'Error ' + e)
    })
    this.emberClient.on('connected', () => {
      Promise.resolve()
        .then(async () => {
          const request = await this.emberClient.getDirectory(this.emberClient.tree)
          await request.response
          await this.registerParameters()
        })
        .catch((e) => {
          // get root
          this.log('error', 'Failed to discover root or subscribe to path: ' + e)
        })
      this.updateStatus(InstanceStatus.Ok)
    })
    this.emberClient.on('disconnected', () => {
      this.updateStatus(InstanceStatus.Connecting)
    })
    this.emberClient.connect().catch((e) => {
      this.updateStatus(InstanceStatus.ConnectionFailure)
      this.log('error', 'Error ' + e)
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

  private setupFeedbackParams(): void {
    if (this.config.feedbackParametersString) {
      this.config.feedbackParameters = this.config.feedbackParametersString.split(',')
    }
  }

  private async registerParameters() {
    for (const path of this.config.feedbackParameters ?? []) {
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
    }
  }
  private async handleChangedValue(path: string, node: TreeElement<EmberElement>) {
    if (node.contents.type == ElementType.Parameter) {
      this.log('debug', 'Got parameter value for ' + path + ': ' + (node.contents.value?.toString() ?? ''))
      this.state.parameters.set(path, node.contents.value?.toString() ?? '')
      this.checkFeedbacks(FeedbackId.Parameter)
    }
  }
}

runEntrypoint(EmberPlusInstance, [])
