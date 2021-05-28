import InstanceSkel = require('../../../instance_skel')
import { CompanionConfigField, CompanionSystem } from '../../../instance_skel_types'
import { GetActionsList } from './actions'
import { EmberPlusConfig, GetConfigFields } from './config'
import { EmberClient } from 'emberplus-connection' // note - emberplus-conn is in parent repo, not sure if it needs to be defined as dependency

/**
 * Companion instance class for the Behringer X32 Mixers.
 */
class EmberPlusInstance extends InstanceSkel<EmberPlusConfig> {
  private emberClient: EmberClient

  /**
   * Create an instance of an EmberPlus module.
   */
  constructor(system: CompanionSystem, id: string, config: EmberPlusConfig) {
    super(system, id, config)

    this.emberClient = new EmberClient(config.host || '', config.port)

    this.updateCompanionBits()
  }

  // Override base types to make types stricter
  public checkFeedbacks(...feedbackTypes: string[]): void {
    // todo - arg should be of type FeedbackId
    super.checkFeedbacks(...feedbackTypes)
  }

  /**
   * Main initialization function called once the module
   * is OK to start doing things.
   */
  public init(): void {
    this.status(this.STATUS_UNKNOWN)
    this.setupEmberConnection()

    this.updateCompanionBits()
  }

  /**
   * Process an updated configuration array.
   */
  public updateConfig(config: EmberPlusConfig): void {
    this.config = config

    this.emberClient.discard()
    this.emberClient.removeAllListeners()

    this.setupEmberConnection()
  }

  /**
   * Creates the configuration fields for web config.
   */
  // eslint-disable-next-line @typescript-eslint/camelcase
  public config_fields(): CompanionConfigField[] {
    return GetConfigFields(this)
  }

  /**
   * Clean up the instance before it is destroyed.
   */
  public destroy(): void {
    this.emberClient.discard()

    this.debug('destroy', this.id)
  }

  private updateCompanionBits(): void {
    this.setActions(GetActionsList(this, this.client))
  }

  private get client(): EmberClient {
    return this.emberClient
  }

  private setupEmberConnection(): void {
    this.log('debug', 'connecting ' + (this.config.host || '') + ':' + this.config.port)
    this.status(this.STATUS_WARNING, 'Connecting')

    this.emberClient = new EmberClient(this.config.host || '', this.config.port)
    this.emberClient.on('error', e => {
      this.log('error', 'Error ' + e)
    })
    this.emberClient.on('connected', () => {
      this.emberClient.getDirectory(this.emberClient.tree) // get root
      this.status(this.STATUS_OK, 'Connected')
    })
    this.emberClient.on('disconnected', () => {
      this.status(this.STATUS_WARNING, 'Reconnecting')
    })
    this.emberClient.connect()
  }
}

export = EmberPlusInstance
