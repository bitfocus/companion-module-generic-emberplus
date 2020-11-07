import InstanceSkel = require('../../../instance_skel')
import { CompanionAction, CompanionActions } from '../../../instance_skel_types'
import { Required as MakeRequired } from 'utility-types'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { EmberPlusConfig } from './config'
import { setFlagsFromString } from 'v8'

export enum ActionId {
  SetValueInt = 'setValueInt'
}

type CompanionActionWithCallback = MakeRequired<CompanionAction, 'callback'>

export function GetActionsList(
  self: InstanceSkel<EmberPlusConfig>,
  emberClient: EmberClient
): CompanionActions {

  const actions: { [id in ActionId]: CompanionActionWithCallback | undefined } = {
    [ActionId.SetValueInt]: {
      label: 'Set Value Integer',
      options: [
        {
          type: 'textinput',
          label: 'Path',
          id: 'path',
        },
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: -0xFFFF,
          max: 0xFFFF,
          default: 0
        }
      ],
      callback: (action): void => {
        emberClient.getElementByPath(action.options['path'] as string).then((node) => { // TODO - do we handle not found?
          if (node && node.contents.type === EmberModel.ElementType.Parameter) {
            self.debug('Got node on ' + action.options['path'])
            // TODO - check for integer?
            emberClient.setValue(
              node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
              action.options['value'] as number,
              false)
          } else {
            self.log('warn', 'Node ' + action.options['path'] + ' not found or not a parameter')
          }
        })
        
      }
    }
  }

  return actions
}
