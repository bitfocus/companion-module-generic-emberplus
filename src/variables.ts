import { CompanionVariableDefinition } from '@companion-module/base'
import { EmberPlusConfig } from './config'

export function GetVariablesList(config: EmberPlusConfig): CompanionVariableDefinition[] {
  return (
    config.monitoredParameters?.map((fb) => ({
      name: fb,
      variableId: fb,
    })) ?? []
  )
}
