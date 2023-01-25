import { Regex, SomeCompanionConfigField } from '@companion-module/base'

export const portDefault = 9000

export interface EmberPlusConfig {
  host?: string
  port?: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
  return [
    {
      type: 'textinput',
      id: 'host',
      label: 'Target IP',
      tooltip: 'The IP of the ember+ provider',
      width: 6,
      regex: Regex.IP,
    },
    {
      type: 'number',
      id: 'port',
      label: 'Target Port',
      tooltip: 'Usually 9000 by default',
      width: 6,
      min: 1,
      max: 0xffff,
      step: 1,
      default: portDefault,
    },
  ]
}
