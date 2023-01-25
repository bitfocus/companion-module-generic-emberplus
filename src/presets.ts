import { CompanionPresetDefinitions, InstanceBase } from '@companion-module/base'
import { EmberPlusConfig } from './config'

// interface CompanionPresetExt extends CompanionButtonPresetDefinition {
//   feedbacks: Array<
//     {
//       type: FeedbackId
//     } & CompanionButtonPresetDefinition['feedbacks'][0]
//   >
//   actions: Array<
//     {
//       action: ActionId
//     } & CompanionPreset['actions'][0]
//   >
//   release_actions?: Array<
//     {
//       action: ActionId
//     } & NonNullable<CompanionPreset['release_actions']>[0]
//   >
// }

export function GetPresetsList(_instance: InstanceBase<EmberPlusConfig>): CompanionPresetDefinitions {
  const presets: CompanionPresetDefinitions = {}

  return presets
}
