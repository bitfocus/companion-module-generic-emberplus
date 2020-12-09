import InstanceSkel = require('../../../instance_skel')
import { CompanionAction, CompanionActionEvent, CompanionActions, CompanionInputFieldTextInput } from '../../../instance_skel_types'
import { Required as MakeRequired } from 'utility-types'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { EmberPlusConfig } from './config'

export enum ActionId {
  SetValueInt = 'setValueInt',
  SetValueReal = "setValueReal",
  SetValueString = "setValueString",
  SetValueBoolean = "setValueBoolean"
}

type CompanionActionWithCallback = MakeRequired<CompanionAction, 'callback'>

const pathInput = {
  type: 'textinput',
  label: 'Path',
  id: 'path',
}
const setValue = (
  self: InstanceSkel<EmberPlusConfig>,
  emberClient: EmberClient,
  type: EmberModel.ParameterType
) => ((action: CompanionActionEvent): void => {
  emberClient.getElementByPath(action.options['path'] as string).then((node) => { // TODO - do we handle not found?
    if (node && node.contents.type === EmberModel.ElementType.Parameter) {
      if (node.contents.parameterType === type) {
        self.debug('Got node on ' + action.options['path'])
        emberClient.setValue(
          node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
          action.options['value'] as number,
          false)
      } else {
        self.log('warn', 'Node ' + action.options['path'] + ' is not of type ' + type)
      }
    } else {
      self.log('warn', 'Node ' + action.options['path'] + ' not found or not a parameter')
    }
  })
})

export function GetActionsList(
  self: InstanceSkel<EmberPlusConfig>,
  emberClient: EmberClient
): CompanionActions {

  const actions: { [id in ActionId]: CompanionActionWithCallback | undefined } = {
    [ActionId.SetValueInt]: {
      label: 'Set Value Integer',
      options: [
        pathInput as CompanionInputFieldTextInput,
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: -0xFFFF,
          max: 0xFFFF,
          default: 0,
          step: 1
        }
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Integer)
    },
    [ActionId.SetValueReal]: {
      label: 'Set Value Real',
      options: [
        pathInput as CompanionInputFieldTextInput,
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: -0xFFFF,
          max: 0xFFFF,
          default: 0,
          step: .001 // TODO - don't want this at all preferably
        }
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Real)
    },
    [ActionId.SetValueBoolean]: {
      label: 'Set Value Boolean',
      options: [
        pathInput as CompanionInputFieldTextInput,
        {
          type: 'checkbox',
          label: 'Value',
          id: 'value',
          default: false
        }
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Boolean)
    },
    [ActionId.SetValueString]: {
      label: 'Set Value String',
      options: [
        pathInput as CompanionInputFieldTextInput,
        {
          type: 'textinput',
          label: 'Value',
          id: 'value',
        }
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Integer)
    },
  }

  return actions
}
