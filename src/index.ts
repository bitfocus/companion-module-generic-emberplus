import { InstanceBase, InstanceStatus, SomeCompanionConfigField, runEntrypoint } from '@companion-module/base'
import { GetActionsList } from './actions'
import { EmberPlusConfig, GetConfigFields } from './config'
import { EmberClient } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency

/**
 * Companion instance class for the Behringer X32 Mixers.
 */
class EmberPlusInstance extends InstanceBase<EmberPlusConfig> {
  private emberClient!: EmberClient
  private config!: EmberPlusConfig

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

    this.setupEmberConnection()

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
    this.setActionDefinitions(GetActionsList(this, this.client))
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
      this.emberClient.getDirectory(this.emberClient.tree).catch((e) => {
        // get root
        this.log('error', 'Failed to discover root: ' + e)
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
}

runEntrypoint(EmberPlusInstance, [])
