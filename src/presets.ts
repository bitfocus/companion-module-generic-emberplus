/* eslint-disable @typescript-eslint/camelcase */
import InstanceSkel = require('../../../instance_skel')
import { CompanionPreset } from '../../../instance_skel_types'
import { ActionId } from './actions'
import { EmberPlusConfig } from './config'
import { FeedbackId } from './feedback'
import { ValuesType, NonUndefined } from 'utility-types'

interface CompanionPresetExt extends CompanionPreset {
  feedbacks: Array<
    {
      type: FeedbackId
    } & CompanionPreset['feedbacks'][0]
  >
  actions: Array<
    {
      action: ActionId
    } & CompanionPreset['actions'][0]
  >
  release_actions?: Array<
    {
      action: ActionId
    } & ValuesType<NonUndefined<CompanionPreset['release_actions']>>
  >
}

export function GetPresetsList(_instance: InstanceSkel<EmberPlusConfig>): CompanionPreset[] {
  const presets: CompanionPresetExt[] = []

  return presets
}
