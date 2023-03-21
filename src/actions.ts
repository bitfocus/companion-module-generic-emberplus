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
import { FeedbackId } from './feedback'
import { EmberPlusState } from './state'

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
  Clear = 'clear',
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

/**
 * Performes a connection on a specified matrix.
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 */
const doMatrixActionFunction = function (
  self: InstanceBase<EmberPlusConfig>,
  emberClient: EmberClient,
  config: EmberPlusConfig,
  state: EmberPlusState
) {
  if (
    state.selected.source !== -1 &&
    state.selected.target !== -1 &&
    state.selected.matrix !== -1 &&
    config.matrices &&
    config.matrices[state.selected.matrix]
  ) {
    self.log('debug', 'Get node ' + state.selected.matrix)
    emberClient
      .getElementByPath(config.matrices[state.selected.matrix])
      .then((node) => {
        // TODO - do we handle not found?
        if (node && node.contents.type === EmberModel.ElementType.Matrix) {
          self.log('debug', 'Got node on ' + state.selected.matrix)
          const target = state.selected.target
          const sources = [state.selected.source]
          emberClient
            .matrixConnect(node as EmberModel.NumberedTreeNode<EmberModel.Matrix>, target, sources)
            .then((r) => self.log('debug', String(r)))
            .catch((r) => self.log('debug', r))
        } else {
          self.log('warn', 'Matrix ' + state.selected.matrix + ' not found or not a parameter')
        }
      })
      .catch((reason) => self.log('debug', reason))
      .finally(() => {
        state.selected.matrix = state.selected.source = state.selected.target = -1
        self.checkFeedbacks(
          FeedbackId.TargetBackgroundSelected,
          FeedbackId.SourceBackgroundSelected,
          FeedbackId.Take,
          FeedbackId.Take
        )
      })
  }
}

/**
 * Gets called, when take is not on Auto-Take.
 * Performes a connect on the wanted matrix
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 */
const doTake =
  (self: InstanceBase<EmberPlusConfig>, emberClient: EmberClient, config: EmberPlusConfig, state: EmberPlusState) =>
  (action: CompanionActionEvent): void => {
    if (
      state.selected.target !== -1 &&
      state.selected.source !== -1 &&
      state.selected.matrix !== -1 &&
      config.matrices
    ) {
      self.log(
        'debug',
        'TAKE: selectedDest: ' +
          state.selected.target +
          ' selected.source: ' +
          state.selected.source +
          ' on matrix ' +
          Number(action.options['matrix'])
      )
      doMatrixActionFunction(self, emberClient, config, state)
    } else {
      self.log('debug', 'TAKE went wrong.')
    }
  }

/**
 * Clear the current selected Source and Target
 * @param self reference to the BaseInstance
 * @param state reference to the modules state
 */
const doClear = (self: InstanceBase<EmberPlusConfig>, state: EmberPlusState) => (): void => {
  state.selected.matrix = state.selected.source = state.selected.target = -1
  self.checkFeedbacks(
    FeedbackId.SourceBackgroundSelected,
    FeedbackId.TargetBackgroundSelected,
    FeedbackId.Take,
    FeedbackId.Clear
  )
}

/**
 * Selects a source on a specific matrix.
 * When Auto-Take is enabled the source is routed to the selected target.
 * @param self reference to the BaseInstance
 * @param emberClient reference to the emberClient
 * @param config reference to the config of the module
 * @param state reference to the state of the module
 */
const setSelectedSource =
  (self: InstanceBase<EmberPlusConfig>, emberClient: EmberClient, config: EmberPlusConfig, state: EmberPlusState) =>
  (action: CompanionActionEvent): void => {
    if (action.options['source'] != -1 && Number(action.options['matrix']) == state.selected.matrix) {
      state.selected.source = Number(action.options['source'])
      self.log('debug', 'Take is: ' + config.take)
      if (config.take) doMatrixActionFunction(self, emberClient, config, state)
      self.checkFeedbacks(FeedbackId.SourceBackgroundSelected, FeedbackId.Clear, FeedbackId.Take)
      self.log('debug', 'setSelectedSource: ' + action.options['source'] + ' on Matrix: ' + state.selected.matrix)
    }
  }

/**
 * Selects a target on a specified matrix.
 * @param self reference to the BaseInstance
 * @param state reference to the state of the module
 */
const setSelectedTarget =
  (self: InstanceBase<EmberPlusConfig>, state: EmberPlusState) =>
  (action: CompanionActionEvent): void => {
    if (action.options['target'] != -1) {
      state.selected.target = Number(action.options['target'])
      state.selected.matrix = Number(action.options['matrix'])
    }
    state.selected.source = -1
    self.checkFeedbacks(
      FeedbackId.SourceBackgroundSelected,
      FeedbackId.TargetBackgroundSelected,
      FeedbackId.Take,
      FeedbackId.Clear
    )
    self.log('debug', 'setSelectedTarget: ' + action.options['target'] + ' on Matrix: ' + state.selected.matrix)
  }

export function GetActionsList(
  self: InstanceBase<EmberPlusConfig>,
  emberClient: EmberClient,
  config: EmberPlusConfig,
  state: EmberPlusState
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
      options: [],
      callback: doTake(self, emberClient, config, state),
    },
    [ActionId.Clear]: {
      name: 'Clear',
      options: [],
      callback: doClear(self, state),
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
      callback: setSelectedSource(self, emberClient, config, state),
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
      callback: setSelectedTarget(self, state),
    },
  }

  return actions
}
