import { CompanionFeedbackDefinition, CompanionFeedbackDefinitions, InstanceBase } from '@companion-module/base'
import { EmberPlusConfig } from './config'
import { EmberClient } from 'emberplus-connection'

export enum FeedbackId {}

export function GetFeedbacksList(
  _self: InstanceBase<EmberPlusConfig>,
  _emberClient: EmberClient
): CompanionFeedbackDefinitions {
  const feedbacks: { [id in FeedbackId]: CompanionFeedbackDefinition | undefined } = {}

  return feedbacks
}
