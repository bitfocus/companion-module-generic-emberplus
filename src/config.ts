import InstanceSkel = require('../../../instance_skel')
import { SomeCompanionConfigField } from '../../../instance_skel_types'

export const portDefault = 9000

export interface EmberPlusConfig {
  host?: string
  port?: number
}

export function GetConfigFields(self: InstanceSkel<EmberPlusConfig>): SomeCompanionConfigField[] {
  return [
    {
      type: 'textinput',
      id: 'host',
      label: 'Target IP',
      tooltip: 'The IP of the ember+ provider',
      width: 6,
      regex: self.REGEX_IP
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
      default: portDefault
    }
  ]
}
