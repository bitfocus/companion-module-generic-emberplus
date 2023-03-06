import {
  CompanionActionDefinition,
  CompanionActionDefinitions,
  CompanionActionEvent,
  CompanionInputFieldNumber,
  CompanionInputFieldTextInput,
  InstanceBase,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { EmberPlusConfig } from './config'

export enum ActionId {
  SetValueInt = 'setValueInt',
  SetValueReal = 'setValueReal',
  SetValueString = 'setValueString',
  SetValueBoolean = 'setValueBoolean',
  SetValueEnum = 'setValueEnum',
  MatrixConnect = 'matrixConnect',
  MatrixDisconnect = 'matrixDisconnect',
  MatrixSetConnection = 'matrixSetConnection',
}

const pathInput: CompanionInputFieldTextInput = {
  type: 'textinput',
  label: 'Path',
  id: 'path',
}
const matrixInputs: Array<CompanionInputFieldTextInput | CompanionInputFieldNumber> = [
  pathInput,
  {
    type: 'number',
    label: 'Target',
    id: 'target',
    required: true,
    min: 0,
    max: 0xffffffff,
    default: 0,
    step: 1,
  },
  {
    type: 'textinput',
    label: 'Sources',
    id: 'sources',
    regex: '/^((\\s*\\d+,)*(\\s*\\d+)$)|$/', // comma separated list
  },
]

const setValue =
  (self: InstanceBase<EmberPlusConfig>, emberClient: EmberClient, type: EmberModel.ParameterType) =>
  async (action: CompanionActionEvent): Promise<void> => {
    const node = await emberClient.getElementByPath(action.options['path'] as string)
    // TODO - do we handle not found?
    if (node && node.contents.type === EmberModel.ElementType.Parameter) {
      if (node.contents.parameterType === type) {
        self.log('debug', 'Got node on ' + action.options['path'])
        const request = await emberClient.setValue(
          node as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
          action.options['value'] as number,
          false
        )
        request.response?.catch(() => null) // Ensure the response is 'handled'
      } else {
        self.log(
          'warn',
          'Node ' + action.options['path'] + ' is not of type ' + type + ' (is ' + node.contents.parameterType + ')'
        )
      }
    } else {
      self.log('warn', 'Parameter ' + action.options['path'] + ' not found or not a parameter')
    }
  }

const doMatrixAction =
  (
    self: InstanceBase<EmberPlusConfig>,
    emberClient: EmberClient,
    method: EmberClient['matrixConnect'] | EmberClient['matrixDisconnect'] | EmberClient['matrixSetConnection']
  ) =>
  async (action: CompanionActionEvent): Promise<void> => {
    self.log('debug', 'Get node ' + action.options['path'])
    const node = await emberClient.getElementByPath(action.options['path'] as string)
    // TODO - do we handle not found?
    if (node && node.contents.type === EmberModel.ElementType.Matrix) {
      self.log('debug', 'Got node on ' + action.options['path'])
      const target = Number(action.options['target'])
      const sources = (action.options['sources'] as string)
        .split(',')
        .filter((v) => v !== '')
        .map((s) => Number(s))
      await method(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
    } else {
      self.log('warn', 'Matrix ' + action.options['path'] + ' not found or not a parameter')
    }
  }

export function GetActionsList(
  self: InstanceBase<EmberPlusConfig>,
  emberClient: EmberClient
): CompanionActionDefinitions {
  const actions: { [id in ActionId]: CompanionActionDefinition | undefined } = {
    [ActionId.SetValueInt]: {
      name: 'Set Value Integer',
      options: [
        pathInput,
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: -0xffffffff,
          max: 0xffffffff,
          default: 0,
          step: 1,
        },
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Integer),
    },
    [ActionId.SetValueReal]: {
      name: 'Set Value Real',
      options: [
        pathInput,
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: -0xffffffff,
          max: 0xffffffff,
          default: 0,
          step: 0.001, // TODO - don't want this at all preferably
        },
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Real),
    },
    [ActionId.SetValueBoolean]: {
      name: 'Set Value Boolean',
      options: [
        pathInput,
        {
          type: 'checkbox',
          label: 'Value',
          id: 'value',
          default: false,
        },
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Boolean),
    },
    [ActionId.SetValueEnum]: {
      name: 'Set Value ENUM (as Integer)',
      options: [
        pathInput,
        {
          type: 'number',
          label: 'Value',
          id: 'value',
          required: true,
          min: 0x00000000,
          max: 0xffffffff,
          default: 0,
          step: 1,
        },
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.Enum),
    },
    [ActionId.SetValueString]: {
      name: 'Set Value String',
      options: [
        pathInput,
        {
          type: 'textinput',
          label: 'Value',
          id: 'value',
        },
      ],
      callback: setValue(self, emberClient, EmberModel.ParameterType.String),
    },
    [ActionId.MatrixConnect]: {
      name: 'Matrix Connect',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixConnect(...args)),
    },
    [ActionId.MatrixDisconnect]: {
      name: 'Matrix Disconnect',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixDisconnect(...args)),
    },
    [ActionId.MatrixSetConnection]: {
      name: 'Matrix Set Connection',
      options: [...matrixInputs],
      callback: doMatrixAction(self, emberClient, async (...args) => emberClient.matrixSetConnection(...args)),
    },
  }

  return actions
}
