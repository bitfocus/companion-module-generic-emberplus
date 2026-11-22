import type {
	CompanionActionDefinitions,
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { type EmberPlusConfig, portDefault } from './config.js'
import type EmberPlusInstance from './index.js'
import { doMatrixAction, doTake, doClear, setSelectedSource, setSelectedTarget } from './actions/matrix.js'
import { learnSetValueActionOptions, setValue, subscribeParameterAction } from './actions/parameter.js'
import { invokeFunctionAction } from './actions/function.js'
import { setHostAction, learnSetHostActionOptions } from './actions/host.js'
import { EmberPlusState } from './state.js'
import { matrixDropdown, sourceFields, targetFields, type MatrixOptions } from './matrixOptions.js'
import { EmberNumberRange, type NumericParameterType } from './ranges.js'
import { filterPathChoices, filterFunctionPathChoices } from './util.js'

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
	InvokeFunction = 'invokeFunction',
	SetHost = 'setHost',
}

export type SetValueIntOptions = {
	path: string
	value: number
	relative: boolean
	min: number
	max: number
	/** An action from before 3.0 with a Factor other than 1: the value in the device's units, multiplied by Factor */
	deviceUnits: boolean
	factor: number
}

export type SetValueRealOptions = {
	path: string
	value: number
	relative: boolean
	min: number
	max: number
}

export type SetValueBooleanOptions = {
	path: string
	toggle: boolean
	value: boolean
}

export type SetValueEnumOptions = {
	path: string
	value: number
	asEnum: boolean
	enumValue: string
	relative: boolean
	min: number
	max: number
}

export type SetValueStringOptions = {
	path: string
	value: string
	parseEscapeChars: boolean
}

/** The options of every Set Value action, as the shared parameter callbacks read them */
export type SetValueOptions = {
	path?: string
	value?: string | number | boolean
	relative?: boolean
	min?: number
	max?: number
	toggle?: boolean
	parseEscapeChars?: boolean
	asEnum?: boolean
	enumValue?: string
	deviceUnits?: boolean
	factor?: number
}

/** The matrix, by its configured path, its target, and its source or (an N:N matrix) sources */
export type MatrixActionOptions = MatrixOptions

/** The actions that work on a matrix, offered only while there is one */
export const MatrixActionIds = [
	ActionId.MatrixConnect,
	ActionId.MatrixDisconnect,
	ActionId.MatrixSetConnection,
	ActionId.Take,
	ActionId.Clear,
	ActionId.SetSelectedSource,
	ActionId.SetSelectedTarget,
] as const

/** The matrix, by its configured path, and its source */
export type SetSelectedSourceOptions = MatrixOptions

/** The matrix, by its configured path, and its target */
export type SetSelectedTargetOptions = MatrixOptions

export type InvokeFunctionOptions = {
	path: string
	args: string
	parseEscapeChars: boolean
}

export type SetHostOptions = {
	host: string
	port: number
}

export type ActionSchema = {
	[ActionId.SetValueInt]: { options: SetValueIntOptions }
	[ActionId.SetValueReal]: { options: SetValueRealOptions }
	[ActionId.SetValueString]: { options: SetValueStringOptions }
	[ActionId.SetValueBoolean]: { options: SetValueBooleanOptions }
	[ActionId.SetValueEnum]: { options: SetValueEnumOptions }
	[ActionId.MatrixConnect]: { options: MatrixActionOptions }
	[ActionId.MatrixDisconnect]: { options: MatrixActionOptions }
	[ActionId.MatrixSetConnection]: { options: MatrixActionOptions }
	[ActionId.Take]: { options: Record<string, never> }
	[ActionId.Clear]: { options: Record<string, never> }
	[ActionId.SetSelectedSource]: { options: SetSelectedSourceOptions }
	[ActionId.SetSelectedTarget]: { options: SetSelectedTargetOptions }
	[ActionId.InvokeFunction]: { options: InvokeFunctionOptions }
	[ActionId.SetHost]: { options: SetHostOptions }
}

const pathTooltip =
	'Path may be supplied in decimals: 1.2.3, text: path.to.ember.element, or with a descriptor and the decimals wrapped in brackets: path to ember element[1.2.3.4]'

/** Registered paths to choose from, or a path typed in. Use expression mode to build the path from variables */
const pathDropDown = {
	type: 'dropdown',
	label: 'Path',
	id: 'path',
	choices: [],
	default: 'No paths configured!',
	allowCustom: true,
	tooltip: `Select a registered path or type one in. ${pathTooltip}`,
} as const satisfies CompanionInputFieldDropdown<'path'>

/**
 * A relative action's limit: a number in the range Ember+ allows the type, the range's ends meaning no limit. An
 * expression beyond the range is held to it rather than skipping the action.
 */
function limit<TKey extends 'min' | 'max'>(
	id: TKey,
	type: NumericParameterType,
	note: string = '',
): CompanionInputFieldNumber<TKey> {
	const range = EmberNumberRange[type]
	const which = id === 'min' ? 'minimum' : 'maximum'
	return {
		type: 'number',
		label: id === 'min' ? 'Minimum' : 'Maximum',
		id,
		min: range.min,
		max: range.max,
		default: id === 'min' ? range.min : range.max,
		asInteger: type !== EmberModel.ParameterType.Real,
		clampValues: true,
		// An enumeration's lower end is its first entry, a real limit
		showMinAsNegativeInfinity: type !== EmberModel.ParameterType.Enum,
		showMaxAsPositiveInfinity: true,
		tooltip: `Relative action ${which} value will be limited to this value${note}`,
		isVisibleExpression: '!!$(options:relative)',
	}
}

const integerTooltip =
	"As displayed: the parameter's formula, or else its factor, converts it to the device's value. A relative change is made to the displayed value"
const realTooltip =
	"As displayed: the parameter's formula, if it has one, converts it to the device's value. A relative change is made to the displayed value"
const deviceUnitsNote = ". In the device's units, not as displayed"

/** A value to set, or for a relative action the amount to change it by, in the range Ember+ allows the type */
function valueNumber(type: NumericParameterType, step: number): CompanionInputFieldNumber<'value'> {
	const { max } = EmberNumberRange[type]
	return {
		type: 'number',
		label: 'Value',
		id: 'value',
		// Negative for a relative change of any type, the callback holding a value set outright to the range
		min: -max,
		max,
		default: 0,
		step,
		asInteger: type !== EmberModel.ParameterType.Real,
	}
}

// Fields named in an isVisibleExpression must not be expressions themselves
/**
 * Set on Set Value Integer actions from before 3.0 whose Factor wasn't 1, so they go on sending their value multiplied by
 * it, in the device's units. Shown only while ticked: unticked, or by Learn, the action takes the displayed value, as
 * new ones do, and the field is gone
 */
const deviceUnits = {
	type: 'checkbox',
	label: 'Device Units',
	id: 'deviceUnits',
	default: false,
	disableAutoExpression: true,
	isVisibleExpression: '!!$(options:deviceUnits)',
	tooltip:
		"From an earlier version: the value is in the device's units, multiplied by Factor, as it was. Untick it, or use Learn, to give the value as displayed, converted by the parameter's own formula or factor",
} as const satisfies CompanionInputFieldCheckbox<'deviceUnits'>

const deviceUnitsFactor = {
	type: 'number',
	label: 'Factor',
	id: 'factor',
	default: 1,
	min: 1,
	max: 0xffffffff,
	step: 1,
	asInteger: true,
	isVisibleExpression: '!!$(options:deviceUnits)',
	tooltip: 'With Device Units, the value is multiplied by this',
} as const satisfies CompanionInputFieldNumber<'factor'>

const relative = {
	type: 'checkbox',
	label: 'Relative',
	id: 'relative',
	default: false,
	tooltip: 'Adjust value by this amount',
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldCheckbox<'relative'>

const asEnum = {
	type: 'checkbox',
	label: 'Set from Enumeration Value?',
	id: 'asEnum',
	default: false,
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldCheckbox<'asEnum'>

const enumVal = {
	type: 'textinput',
	label: 'Enumeration',
	id: 'enumValue',
	useVariables: true,
	default: '',
	tooltip: 'Must exactly match a valid enumeration value',
	isVisibleExpression: '!!$(options:asEnum)',
} as const satisfies CompanionInputFieldTextInput<'enumValue'>

/** The path dropdown, listing the registered parameters of a type, or the first of them as the default */
function pathChoices(
	state: EmberPlusState,
	paramType: EmberModel.ParameterType,
): CompanionInputFieldDropdown<'path', string | number> {
	const choices = filterPathChoices(state, true, paramType)
	return { ...pathDropDown, choices, default: choices[0]?.id ?? pathDropDown.default }
}

export function GetActionsList(
	self: EmberPlusInstance,
	emberClient: EmberClient,
	config: EmberPlusConfig,
	state: EmberPlusState,
	queue: PQueue,
): CompanionActionDefinitions<ActionSchema> {
	const functionChoices = filterFunctionPathChoices(state)

	const actions: CompanionActionDefinitions<ActionSchema> = {
		[ActionId.SetValueInt]: {
			name: 'Set Value Integer',
			options: [
				pathChoices(state, EmberModel.ParameterType.Integer),
				// As displayed, so a fraction can be meant: the parameter's formula or factor converts it, rounding
				{ ...valueNumber(EmberModel.ParameterType.Integer, 1), asInteger: false, tooltip: integerTooltip },
				relative,
				limit('min', EmberModel.ParameterType.Integer, deviceUnitsNote),
				limit('max', EmberModel.ParameterType.Integer, deviceUnitsNote),
				deviceUnits,
				deviceUnitsFactor,
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Integer, ActionId.SetValueInt, state, queue),
			subscribe: subscribeParameterAction(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Integer, ActionId.SetValueInt),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.SetValueReal]: {
			name: 'Set Value Real',
			options: [
				pathChoices(state, EmberModel.ParameterType.Real),
				// TODO - don't want the step at all preferably
				{ ...valueNumber(EmberModel.ParameterType.Real, 0.001), tooltip: realTooltip },
				relative,
				limit('min', EmberModel.ParameterType.Real, deviceUnitsNote),
				limit('max', EmberModel.ParameterType.Real, deviceUnitsNote),
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Real, ActionId.SetValueReal, state, queue),
			subscribe: subscribeParameterAction(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Real, ActionId.SetValueReal),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.SetValueBoolean]: {
			name: 'Set Value Boolean',
			options: [
				pathChoices(state, EmberModel.ParameterType.Boolean),
				{
					type: 'checkbox',
					label: 'Toggle',
					id: 'toggle',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'checkbox',
					label: 'Value',
					id: 'value',
					default: false,
					isVisibleExpression: '!$(options:toggle)',
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Boolean, ActionId.SetValueBoolean, state, queue),
			subscribe: subscribeParameterAction(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Boolean, ActionId.SetValueBoolean),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.SetValueEnum]: {
			name: 'Set Value ENUM',
			options: [
				pathChoices(state, EmberModel.ParameterType.Enum),
				{
					...valueNumber(EmberModel.ParameterType.Enum, 1),
					isVisibleExpression: '!$(options:asEnum)',
				},
				enumVal,
				asEnum,
				{
					...relative,
					isVisibleExpression: '!$(options:asEnum)',
				},
				{
					...limit('min', EmberModel.ParameterType.Enum),
					isVisibleExpression: '!$(options:asEnum) && !!$(options:relative)',
				},
				{
					...limit('max', EmberModel.ParameterType.Enum),
					isVisibleExpression: '!$(options:asEnum) && !!$(options:relative)',
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.Enum, ActionId.SetValueEnum, state, queue),
			subscribe: subscribeParameterAction(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.Enum, ActionId.SetValueEnum),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.SetValueString]: {
			name: 'Set Value String',
			options: [
				pathChoices(state, EmberModel.ParameterType.String),
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					useVariables: true,
					multiline: true,
					default: '',
				},
				{
					type: 'checkbox',
					label: 'Parse escape characters',
					id: 'parseEscapeChars',
					default: true,
					tooltip: 'Parse escape characters such as \\r \\n \\t',
				},
			],
			callback: setValue(self, emberClient, EmberModel.ParameterType.String, ActionId.SetValueString, state, queue),
			subscribe: subscribeParameterAction(self),
			learn: learnSetValueActionOptions(state, EmberModel.ParameterType.String, ActionId.SetValueString),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.MatrixConnect]: {
			name: 'Matrix Connect',
			description: 'Connect sources to a target, as well as those connected to it (for an N:N matrix)',
			options: [matrixDropdown(state), ...targetFields(state), ...sourceFields(state, { several: true })],
			callback: doMatrixAction(self, emberClient, 'connect', queue, state),
		},
		[ActionId.MatrixDisconnect]: {
			name: 'Matrix Disconnect',
			description: 'Disconnect sources from a target',
			options: [matrixDropdown(state), ...targetFields(state), ...sourceFields(state, { several: true })],
			callback: doMatrixAction(self, emberClient, 'disconnect', queue, state),
		},
		[ActionId.MatrixSetConnection]: {
			name: 'Matrix Set Connection',
			description:
				"Connect exactly these sources to a target, replacing those connected to it. None disconnects the target's sources",
			options: [matrixDropdown(state), ...targetFields(state), ...sourceFields(state, { several: true, none: true })],
			callback: doMatrixAction(self, emberClient, 'absolute', queue, state),
		},
		[ActionId.Take]: {
			name: 'Take',
			options: [],
			callback: doTake(self, emberClient, state, queue),
		},
		[ActionId.Clear]: {
			name: 'Clear',
			options: [],
			callback: doClear(self, state),
		},
		[ActionId.SetSelectedSource]: {
			name: 'Set Selected Source',
			options: [matrixDropdown(state), ...sourceFields(state, { several: false })],
			callback: setSelectedSource(self, emberClient, config, state, queue),
		},
		[ActionId.SetSelectedTarget]: {
			name: 'Set Selected Target',
			options: [matrixDropdown(state), ...targetFields(state)],
			callback: setSelectedTarget(self, state),
		},
		[ActionId.InvokeFunction]: {
			name: 'Invoke Function',
			options: [
				{
					...pathDropDown,
					choices: functionChoices,
					default: functionChoices[0]?.id ?? 'No functions configured!',
				},
				{
					type: 'textinput',
					label: 'Arguments',
					id: 'args',
					useVariables: true,
					multiline: true,
					default: '',
					tooltip:
						'Enter arguments comma-separated, line-separated, or as a JSON array (e.g. [123, "text", true]). Dynamic variables are supported.',
				},
				{
					type: 'checkbox',
					label: 'Parse escape characters',
					id: 'parseEscapeChars',
					default: true,
					tooltip: 'Parse escape characters such as \\r \\n \\t in text arguments',
				},
			],
			callback: invokeFunctionAction(self, emberClient, state, queue),
			subscribe: subscribeParameterAction(self),
			optionsToMonitorForSubscribe: ['path'],
		},
		[ActionId.SetHost]: {
			name: 'Set Host',
			options: [
				{
					type: 'textinput',
					label: 'Connection Host',
					id: 'host',
					useVariables: true,
					default: config.host ?? '',
					minLength: 1,
					tooltip:
						'The Hostname/IP of the Ember+ provider. Overrides any device selected by Bonjour. Leave empty to keep the current host.',
				},
				{
					type: 'number',
					label: 'Connection Port',
					id: 'port',
					default: config.port ?? portDefault,
					tooltip: 'The port of the Ember+ provider. Use expression mode to set it from a variable',
					min: 1,
					max: 65535,
					step: 1,
					asInteger: true,
				},
			],
			callback: setHostAction(self),
			learn: learnSetHostActionOptions(config),
		},
	}
	// Without a matrix to work on (none configured, or none the provider has), the matrix actions aren't offered
	if (state.matrices.size === 0) for (const id of MatrixActionIds) actions[id] = undefined
	return actions
}
