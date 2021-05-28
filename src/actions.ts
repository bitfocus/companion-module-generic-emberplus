import InstanceSkel = require('../../../instance_skel')
import {
  CompanionAction,
  CompanionActionEvent,
  CompanionActions,
  CompanionInputFieldNumber,
  CompanionInputFieldTextInput
} from '../../../instance_skel_types'
import { Required as MakeRequired } from 'utility-types'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { EmberPlusConfig } from './config'

export enum ActionId {
  SetValueInt = 'setValueInt',
  SetValueReal = 'setValueReal',
  SetValueString = 'setValueString',
  SetValueBoolean = 'setValueBoolean',
  MatrixConnect = 'matrixConnect',
  MatrixDisconnect = 'matrixDisconnect',
  MatrixSetConnection = 'matrixSetConnection'
}

type CompanionActionWithCallback = MakeRequired<CompanionAction, 'callback'>

const pathInput: CompanionInputFieldTextInput = {
  type: 'textinput',
  label: 'Path',
  id: 'path'
}
const matrixInputs: Array<CompanionInputFieldTextInput | CompanionInputFieldNumber> = [
  pathInput,
  {
    type: 'number',
    label: 'Target',
    id: 'target',
    required: true,
    min: 0,
    max: 0xffff,
    default: 0,
    step: 1
  },
  {
    type: 'textinput',
    label: 'Sources',
    id: 'sources',
    regex: '/^((\\s*\\d+,)*(\\s*\\d+)$)|$/' // comma separated list
  }
]

const setValue = (self: InstanceSkel<EmberPlusConfig>, emberClient: EmberClient, type: EmberModel.ParameterType) => (
  action: CompanionActionEvent
): void => {
  emberClient.getElementByPath(action.options['path'] as string).then(node => {
    // TODO - do we handle not found?
    if (node && node.contents.type === EmberModel.ElementType.Parameter) {
      if (node.contents.parameterType === type) {
        self.debug('Got node on ' + action.options['path'])
        emberClient.setValue(
          node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
          action.options['value'] as number,
          false
        )
      } else {
        self.log('warn', 'Node ' + action.options['path'] + ' is not of type ' + type)
      }
    } else {
      self.log('warn', 'Parameter ' + action.options['path'] + ' not found or not a parameter')
    }
  })
}

const doMatrixAction = (
  self: InstanceSkel<EmberPlusConfig>,
  emberClient: EmberClient,
  method: EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection']
) => (action: CompanionActionEvent): void => {
  self.debug('Get node ' + action.options['path'])
  emberClient.getElementByPath(action.options['path'] as string).then(node => {
    // TODO - do we handle not found?
    if (node && node.contents.type === EmberModel.ElementType.Matrix) {
      self.debug('Got node on ' + action.options['path'])
      const target = Number(action.options['target'])
      const sources = (action.options['sources'] as string)
        .split(',')
        .filter(v => v !== '')
        .map(s => Number(s))
      method(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
    } else {
      self.log('warn', 'Matrix ' + action.options['path'] + ' not found or not a parameter')
    }
  })
}

export function GetActionsList(self: InstanceSkel<EmberPlusConfig>, emberClient: EmberClient): CompanionActions {
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
          min: -0xffff,
          max: 0xffff,
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
          min: -0xffff,
          max: 0xffff,
          default: 0,
          step: 0.001 // TODO - don't want this at all preferably
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
          id: 'value'
        }
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Integer)
    },
    [ActionId.MatrixConnect]: {
      label: 'Matrix Connect',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, (...args) => emberClient.matrixConnect(...args))
    },
    [ActionId.MatrixDisconnect]: {
      label: 'Matrix Disconnect',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, (...args) => emberClient.matrixDisconnect(...args))
    },
    [ActionId.MatrixSetConnection]: {
      label: 'Matrix Set Connection',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, (...args) => emberClient.matrixSetConnection(...args))
    }
  }

  return actions
}
