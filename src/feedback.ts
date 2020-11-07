import {
  CompanionFeedback,
  CompanionFeedbacks,
} from '../../../instance_skel_types'
import InstanceSkel = require('../../../instance_skel')
import {  EmberPlusConfig } from './config'
import { EmberClient } from 'emberplus-connection'

type CompanionFeedbackWithCallback = CompanionFeedback &
  Required<Pick<CompanionFeedback, 'callback' | 'subscribe' | 'unsubscribe'>>

export enum FeedbackId {
}

export function GetFeedbacksList(
  _self: InstanceSkel<EmberPlusConfig>,
  _emberClient: EmberClient
): CompanionFeedbacks {

  const feedbacks: { [id in FeedbackId]: CompanionFeedbackWithCallback | undefined } = {
  }

  return feedbacks
}
