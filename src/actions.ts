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
  Take = 'take',
  SetSelectedSource = 'setSelectedSource',
  SetSelectedTarget = 'setSelectedTarget',
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

const doMatrixActionFunction = function (
  self: InstanceBase<EmberPlusConfig>,
  emberClient: EmberClient,
  config: EmberPlusConfig,
  selMatrix: number
) {
  if (
    config.selectedSource &&
    config.selectedDestination &&
    config.matrices &&
    config.selectedSource[selMatrix] !== -1 &&
    config.selectedDestination[selMatrix] !== -1
  ) {
    self.log('debug', 'Get node ' + config.matrices[selMatrix])
    emberClient
      .getElementByPath(config.matrices[selMatrix])
      .then((node) => {
        // TODO - do we handle not found?
        if (node && node.contents.type === EmberModel.ElementType.Matrix) {
          self.log('debug', 'Got node on ' + selMatrix)
          const target = config.selectedDestination[selMatrix]
          const sources = [config.selectedSource[selMatrix]]
          emberClient
            .matrixConnect(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
            .then((r) => self.log('debug', String(r)))
            .catch((r) => self.log('debug', r))
        } else {
          self.log('warn', 'Matrix ' + selMatrix + ' not found or not a parameter')
        }
      })
      .catch((reason) => self.log('debug', reason))
  }
}

const doTake =
  (self: InstanceBase<EmberPlusConfig>, emberClient: EmberClient, config: EmberPlusConfig) =>
  (action: CompanionActionEvent): void => {
    if (config.selectedDestination && config.selectedSource && config.matrices) {
      if (
        config.selectedDestination[Number(action.options['matrix'])] !== -1 &&
        config.selectedSource[Number(action.options['matrix'])] !== -1
      ) {
        doMatrixActionFunction(self, emberClient, config, Number(action.options['matrix']))
      } else {
        self.log('debug', 'TAKE went wrong.')
      }
      self.log(
        'debug',
        'TAKE: selectedDest: ' +
          config.selectedDestination[Number(action.options['matrix'])] +
          ' selectedSource: ' +
          config.selectedSource[Number(action.options['matrix'])] +
          ' on matrix ' +
          Number(action.options['matrix'])
      )
    }
  }

const setSelectedSource =
  (self: InstanceBase<EmberPlusConfig>, emberClient: EmberClient, config: EmberPlusConfig) =>
  (action: CompanionActionEvent): void => {
    if (action.options['source'] != -1 && action.options['matrix'] != -1 && config.selectedSource) {
      config.selectedSource[Number(action.options['matrix'])] = Number(action.options['source'])
    }
    self.log('debug', 'Take is: ' + config.take)
    if (config.take) doMatrixActionFunction(self, emberClient, config, Number(action.options['matrix']))
    //self.checkFeedbacks(FeedbackId.SourceBackgroundSelected)
    self.log('debug', 'setSelectedSource: ' + action.options['source'] + ' on Matrix: ' + action.options['matrix'])
  }

const setSelectedTarget =
  (self: InstanceBase<EmberPlusConfig>, config: EmberPlusConfig) =>
  (action: CompanionActionEvent): void => {
    if (action.options['target'] != -1 && action.options['matrix'] != -1 && config.selectedDestination) {
      config.selectedDestination[Number(action.options['matrix'])] = Number(action.options['target'])
    }
    //self.checkFeedbacks(FeedbackId.TargetBackgroundSelected)
    self.log('debug', 'setSelectedTarget: ' + action.options['target'] + ' on Matrix: ' + action.options['matrix'])
  }

export function GetActionsList(
  self: InstanceBase<EmberPlusConfig>,
  emberClient: EmberClient,
  config: EmberPlusConfig
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
    [ActionId.Take]: {
      name: 'Take',
      options: [
        {
          type: 'number',
          label: 'Matrix Number',
          id: 'matrix',
          required: true,
          min: 0,
          max: 0xffffffff,
          default: 0,
        },
      ],
      callback: doTake(self, emberClient, config),
    },
    [ActionId.SetSelectedSource]: {
      name: 'Set Selected Source',
      options: [
        {
          type: 'number',
          label: 'Select Matrix Number',
          id: 'matrix',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
        {
          type: 'number',
          label: 'Value',
          id: 'source',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
      ],
      callback: setSelectedSource(self, emberClient, config),
    },
    [ActionId.SetSelectedTarget]: {
      name: 'Set Selected Target',
      options: [
        {
          type: 'number',
          label: 'Select Matrix Number',
          id: 'matrix',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
        {
          type: 'number',
          label: 'Value',
          id: 'target',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
      ],
      callback: setSelectedTarget(self, config),
    },
  }

  return actions
}
