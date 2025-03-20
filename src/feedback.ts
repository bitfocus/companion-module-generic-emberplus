import { combineRgb /*InstanceBase*/ } from '@companion-module/base'
import type {
	CompanionFeedbackDefinition,
	CompanionFeedbackDefinitions,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionInputFieldCheckbox,
	CompanionInputFieldNumber,
	CompanionOptionValues,
} from '@companion-module/base'
import type { EmberPlusInstance } from './index'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import type { EmberPlusConfig } from './config'
import {
	learnParameterFeedbackOptions,
	parameterFeedbackCallback,
	subscribeParameterFeedback,
	unsubscribeParameterFeedback,
} from './parameter'
import { EmberPlusState } from './state'
import { comparitorOptions, filterPathChoices, NumberComparitor } from './util'

export enum FeedbackId {
	Parameter = 'parameter',
	String = 'string',
	Boolean = 'boolean',
	ENUM = 'enum',
	Take = 'take',
	Clear = 'clear',
	SourceBackgroundSelected = 'sourceBackgroundSelected',
	TargetBackgroundSelected = 'targetBackgroundSelected',
}

export interface parameterFeedbackOptions extends CompanionOptionValues {
	path: string
	pathVar: string
	usePathVar: boolean
	value: string | number | boolean
	useVar?: boolean
	valueVar?: string
	comparitor: NumberComparitor
	relative?: boolean
	factor?: string
	asInt?: boolean
	parseEscapeChars?: boolean
}

const styles = {
	blackOnWhite: {
		bgcolor: combineRgb(255, 255, 255),
		color: combineRgb(0, 0, 0),
	},
	blackOnRed: {
		bgcolor: combineRgb(255, 0, 0),
		color: combineRgb(0, 0, 0),
	},
}

const pathDropDown: CompanionInputFieldDropdown = {
	type: 'dropdown',
	label: 'Select registered path',
	id: 'path',
	choices: [],
	default: 'No paths configured!',
	allowCustom: true,
}

const pathString: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Path',
	id: 'pathVar',
	required: true,
	useVariables: { local: true },
	default: '',
}
const usePathVar: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Path from String',
	id: 'usePathVar',
	default: false,
}

const valueText: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Value',
	id: 'value',
	required: true,
	useVariables: { local: true },
	default: '',
}

const valueNumber: CompanionInputFieldNumber = {
	type: 'number',
	label: 'Value',
	id: 'value',
	required: true,
	min: -0xffffffff,
	max: 0xffffffff,
	default: 0,
}

const comparitorDropdown: CompanionInputFieldDropdown = {
	type: 'dropdown',
	label: 'Comparitor',
	id: 'comparitor',
	choices: comparitorOptions,
	default: comparitorOptions[0].id,
	allowCustom: false,
}

const useVarCheckbox: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Use Variable?',
	id: 'useVar',
	default: false,
}
const asIntCheckbox: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'As Integers?',
	id: 'asInt',
	default: false,
	tooltip: '',
}

const factorOpt: CompanionInputFieldTextInput = {
	type: 'textinput',
	label: 'Factor',
	id: 'factor',
	useVariables: { local: true },
	default: '1',
	tooltip: `Value will be multiplied by this field`,
}

const parseEscapeCharactersCheckBox: CompanionInputFieldCheckbox = {
	type: 'checkbox',
	label: 'Parse escape characters',
	id: 'parseEscapeChars',
	default: true,
	tooltip: 'Parse escape characters such as \\r \\n \\t',
}

const matrixNumber: CompanionInputFieldNumber = {
	type: 'number',
	label: 'Select Matrix Number',
	id: 'matrix',
	required: true,
	min: -0,
	max: 0xffffffff,
	default: 0,
}

const sourceNumber: CompanionInputFieldNumber = {
	type: 'number',
	label: 'Value',
	id: 'source',
	required: true,
	min: -0,
	max: 0xffffffff,
	default: 0,
}

const targetNumber: CompanionInputFieldNumber = {
	type: 'number',
	label: 'Value',
	id: 'target',
	required: true,
	min: -0,
	max: 0xffffffff,
	default: 0,
}

export function GetFeedbacksList(
	self: EmberPlusInstance, //InstanceBase<EmberPlusConfig>,
	_emberClient: EmberClient,
	_config: EmberPlusConfig,
	state: EmberPlusState,
): CompanionFeedbackDefinitions {
	const feedbacks: { [id in FeedbackId]: CompanionFeedbackDefinition | undefined } = {
		[FeedbackId.Parameter]: {
			name: 'Parameter Compare Number',
			description: 'Checks the current value of a parameter',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(
						state,
						false,
						EmberModel.ParameterType.Enum,
						EmberModel.ParameterType.Real,
						EmberModel.ParameterType.Integer,
					),
					default:
						filterPathChoices(
							state,
							false,
							EmberModel.ParameterType.Enum,
							EmberModel.ParameterType.Real,
							EmberModel.ParameterType.Integer,
						).find(() => true)?.id ?? 'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
				comparitorDropdown,
				{
					...valueNumber,
					isVisible: (options) => {
						return !options.useVar
					},
				},
				{
					...valueText,
					id: 'valueVar',
					default: '0',
					isVisible: (options) => {
						return !!options.useVar
					},
				},
				useVarCheckbox,
				asIntCheckbox,
				{
					...factorOpt,
					isVisible: (options) => {
						return !!options.asInt
					},
				},
			],
			callback: parameterFeedbackCallback(self, state, FeedbackId.Parameter),
			subscribe: subscribeParameterFeedback(state, self),
			unsubscribe: unsubscribeParameterFeedback(state),
			learn: learnParameterFeedbackOptions(state, FeedbackId.Parameter),
		},
		[FeedbackId.String]: {
			name: 'Parameter Equals String',
			description: 'Checks the current value of a parameter against a String',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, false, EmberModel.ParameterType.String),
					default:
						filterPathChoices(state, false, EmberModel.ParameterType.String).find(() => true)?.id ??
						'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
				valueText,
				parseEscapeCharactersCheckBox,
			],
			callback: parameterFeedbackCallback(self, state, FeedbackId.String),
			subscribe: subscribeParameterFeedback(state, self),
			unsubscribe: unsubscribeParameterFeedback(state),
			learn: learnParameterFeedbackOptions(state, FeedbackId.String),
		},
		[FeedbackId.ENUM]: {
			name: 'Parameter ENUM Equals String',
			description: 'Checks the current Enumeration of an ENUM parameter against a String',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, false, EmberModel.ParameterType.Enum),
					default:
						filterPathChoices(state, false, EmberModel.ParameterType.Enum).find(() => true)?.id ??
						'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
				valueText,
			],
			callback: parameterFeedbackCallback(self, state, FeedbackId.ENUM),
			subscribe: subscribeParameterFeedback(state, self),
			unsubscribe: unsubscribeParameterFeedback(state),
			learn: learnParameterFeedbackOptions(state, FeedbackId.ENUM),
		},
		[FeedbackId.Boolean]: {
			name: 'Parameter True',
			description: 'Checks the current value of a paramter is true',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, false, EmberModel.ParameterType.Boolean),
					default:
						filterPathChoices(state, false, EmberModel.ParameterType.Boolean).find(() => true)?.id ??
						'No paths configured!',
					isVisible: (options) => {
						return !options.usePathVar
					},
				},
				{
					...pathString,
					isVisible: (options) => {
						return !!options.usePathVar
					},
				},
				usePathVar,
			],
			callback: parameterFeedbackCallback(self, state, FeedbackId.Boolean),
			subscribe: subscribeParameterFeedback(state, self),
			unsubscribe: unsubscribeParameterFeedback(state),
		},
		[FeedbackId.Take]: {
			name: 'Take is possible',
			description: 'Shows if there is take possible',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [],
			callback: () => {
				return state.selected.target != -1 && state.selected.source != -1 && state.selected.matrix != -1
			},
		},
		[FeedbackId.Clear]: {
			name: 'Clear is possible',
			description: 'Changes when a selection is made.',
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [],
			callback: () => {
				return state.selected.target != -1 || state.selected.source != -1 || state.selected.matrix != -1
			},
		},
		[FeedbackId.SourceBackgroundSelected]: {
			name: 'Source Background If Selected',
			description: 'Change Background of Source, when it is currently selected.',
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [matrixNumber, sourceNumber],
			callback: (feedback) => {
				return (
					state.selected.source == feedback.options['source'] && state.selected.matrix == feedback.options['matrix']
				)
			},
		},
		[FeedbackId.TargetBackgroundSelected]: {
			name: 'Target Background if Selected',
			description: 'Change Background of Target, when it is currently selected.',
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [matrixNumber, targetNumber],
			callback: (feedback) => {
				return (
					state.selected.target == feedback.options['target'] && state.selected.matrix == feedback.options['matrix']
				)
			},
		},
	}

	return feedbacks
}
