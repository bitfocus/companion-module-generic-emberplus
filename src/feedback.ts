import { combineRgb } from '@companion-module/base'
import type {
	CompanionFeedbackDefinitions,
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldStaticText,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import type EmberPlusInstance from './index.js'
import { EmberClient, Model as EmberModel } from '@phillipivan/emberplus-connection'
import type { EmberPlusConfig } from './config.js'
import {
	learnParameterFeedbackOptions,
	parameterFeedbackCallback,
	parameterPropertyFeedbackCallback,
	unsubscribeParameterFeedback,
} from './feedbacks/parameter.js'
import { parameterPropertyChoices, type ParameterProperty, type ParameterPropertyValue } from './feedbacks/property.js'
import { EmberSignalRange } from './ranges.js'
import { EmberPlusState } from './state.js'
import { comparitorOptions, filterPathChoices, NumberComparitor } from './util.js'

export enum FeedbackId {
	Parameter = 'parameter',
	String = 'string',
	Boolean = 'boolean',
	ENUM = 'enum',
	ParameterProperty = 'parameter_property',
	Take = 'take',
	Clear = 'clear',
	SourceBackgroundSelected = 'sourceBackgroundSelected',
	TargetBackgroundSelected = 'targetBackgroundSelected',
}

export type ParameterCompareOptions = {
	path: string
	comparitor: NumberComparitor
	value: number
	asInt: boolean
	factor: number
}

export type ParameterStringOptions = {
	path: string
	value: string
	parseEscapeChars: boolean
}

export type ParameterEnumOptions = {
	path: string
	value: string
}

export type ParameterBooleanOptions = {
	path: string
}

export type ParameterPropertyOptions = {
	path: string
	property: ParameterProperty
}

/** The options of every parameter feedback, as the shared parameter callbacks read them */
export type ParameterFeedbackOptions = {
	path?: string
	value?: string | number
	comparitor?: NumberComparitor
	asInt?: boolean
	factor?: number
	parseEscapeChars?: boolean
	property?: ParameterProperty
}

export type SourceSelectedOptions = {
	matrix: number
	source: number
}

export type TargetSelectedOptions = {
	matrix: number
	target: number
}

export type FeedbackSchema = {
	[FeedbackId.Parameter]: { type: 'boolean'; options: ParameterCompareOptions }
	[FeedbackId.String]: { type: 'boolean'; options: ParameterStringOptions }
	[FeedbackId.Boolean]: { type: 'boolean'; options: ParameterBooleanOptions }
	[FeedbackId.ENUM]: { type: 'boolean'; options: ParameterEnumOptions }
	[FeedbackId.ParameterProperty]: { type: 'value'; options: ParameterPropertyOptions; result: ParameterPropertyValue }
	[FeedbackId.Take]: { type: 'boolean'; options: Record<string, never> }
	[FeedbackId.Clear]: { type: 'boolean'; options: Record<string, never> }
	[FeedbackId.SourceBackgroundSelected]: { type: 'boolean'; options: SourceSelectedOptions }
	[FeedbackId.TargetBackgroundSelected]: { type: 'boolean'; options: TargetSelectedOptions }
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
} as const

const pathTooltip =
	'Select a registered path or type one in. Path may be supplied in decimals: 1.2.3, text: path.to.ember.element, or with a descriptor and the decimals wrapped in brackets: path to ember element[1.2.3.4]'

/** Registered paths to choose from, or a path typed in. Use expression mode to build the path from variables */
const pathDropDown = {
	type: 'dropdown',
	label: 'Path',
	id: 'path',
	choices: [],
	default: 'No paths configured!',
	allowCustom: true,
	tooltip: pathTooltip,
} as const satisfies CompanionInputFieldDropdown<'path'>

const valueText = {
	type: 'textinput',
	label: 'Value',
	id: 'value',
	useVariables: true,
	default: '',
	multiline: true,
} as const satisfies CompanionInputFieldTextInput<'value'>

const valueNumber = {
	type: 'number',
	label: 'Value',
	id: 'value',
	min: -0xffffffff,
	max: 0xffffffff,
	default: 0,
} as const satisfies CompanionInputFieldNumber<'value'>

const comparitorDropdown = {
	type: 'dropdown',
	label: 'Comparitor',
	id: 'comparitor',
	choices: comparitorOptions,
	default: comparitorOptions[0].id,
	allowCustom: false,
} as const satisfies CompanionInputFieldDropdown<'comparitor', NumberComparitor>

// Named in the factor's isVisibleExpression, so it must not be an expression itself
const asIntCheckbox = {
	type: 'checkbox',
	label: 'As Integers?',
	id: 'asInt',
	default: false,
	tooltip: '',
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldCheckbox<'asInt'>

const factorOpt = {
	type: 'number',
	label: 'Factor',
	id: 'factor',
	default: 1,
	min: 1,
	max: 0xffffffff,
	step: 1,
	asInteger: true,
	tooltip: `Value will be multiplied by this field`,
	isVisibleExpression: '!!$(options:asInt)',
} as const satisfies CompanionInputFieldNumber<'factor'>

const parseEscapeCharactersCheckBox = {
	type: 'checkbox',
	label: 'Parse escape characters',
	id: 'parseEscapeChars',
	default: true,
	tooltip: 'Parse escape characters such as \\r \\n \\t',
} as const satisfies CompanionInputFieldCheckbox<'parseEscapeChars'>

const propertyDropdown = {
	type: 'dropdown',
	label: 'Property',
	id: 'property',
	choices: parameterPropertyChoices,
	default: parameterPropertyChoices[0].id,
	tooltip:
		'Value: integers divided by their factor. Value with Units: by formula or factor, formatted, then the unit. Value by Formula and Value as Enumeration Entry: the plain value for a parameter without a formula, or without an enumeration. The rest as the provider reports them, or nothing for one it leaves out',
} as const satisfies CompanionInputFieldDropdown<'property', ParameterProperty>

const indexNumber = {
	type: 'number',
	min: 0,
	max: 0xffffffff,
	default: 0,
	step: 1,
	asInteger: true,
} as const satisfies Omit<CompanionInputFieldNumber, 'id' | 'label'>

const matrixNumber = { ...indexNumber, label: 'Select Matrix Number', id: 'matrix' } as const

/** A matrix target or source, in the range Ember+ allows */
const signalNumber = {
	type: 'number',
	min: EmberSignalRange.min,
	max: EmberSignalRange.max,
	default: 0,
	step: 1,
	asInteger: true,
} as const satisfies Omit<CompanionInputFieldNumber, 'id' | 'label'>

const valueFeedbackInfo = {
	type: 'static-text',
	id: 'info',
	label: '',
	value:
		'With Parameter - Values selected in the Connection Variables config option, the parameter also gets a connection variable, holding its value.',
} as const satisfies CompanionInputFieldStaticText

/** The note on the parameter feedbacks that Parameter Property and an expression replace */
const deprecated = 'Deprecated: will be removed in a future release. Use Parameter Property in an expression instead.'

/** The path dropdown, listing the registered parameters of the types given (any type if none), the first as default */
function pathChoices(
	state: EmberPlusState,
	...paramTypes: EmberModel.ParameterType[]
): CompanionInputFieldDropdown<'path', string | number> {
	const choices = filterPathChoices(state, false, ...paramTypes)
	return { ...pathDropDown, choices, default: choices[0]?.id ?? pathDropDown.default }
}

export function GetFeedbacksList(
	self: EmberPlusInstance,
	_emberClient: EmberClient,
	_config: EmberPlusConfig,
	state: EmberPlusState,
): CompanionFeedbackDefinitions<FeedbackSchema> {
	// No subscribe hook in API 2: each parameter callback registers its path when it runs
	return {
		[FeedbackId.Parameter]: {
			name: 'Parameter Compare Number (Deprecated)',
			description: `Checks the current value of a parameter. ${deprecated}`,
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				pathChoices(
					state,
					EmberModel.ParameterType.Enum,
					EmberModel.ParameterType.Real,
					EmberModel.ParameterType.Integer,
				),
				comparitorDropdown,
				valueNumber,
				asIntCheckbox,
				factorOpt,
			],
			callback: parameterFeedbackCallback(self, state, FeedbackId.Parameter),
			unsubscribe: unsubscribeParameterFeedback(self),
			learn: learnParameterFeedbackOptions(state, FeedbackId.Parameter),
		},
		[FeedbackId.String]: {
			name: 'Parameter Equals String (Deprecated)',
			description: `Checks the current value of a parameter against a String. ${deprecated}`,
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [pathChoices(state, EmberModel.ParameterType.String), valueText, parseEscapeCharactersCheckBox],
			callback: parameterFeedbackCallback(self, state, FeedbackId.String),
			unsubscribe: unsubscribeParameterFeedback(self),
			learn: learnParameterFeedbackOptions(state, FeedbackId.String),
		},
		[FeedbackId.ENUM]: {
			name: 'Parameter ENUM Equals String (Deprecated)',
			description: `Checks the current Enumeration of an ENUM parameter against a String. ${deprecated}`,
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [pathChoices(state, EmberModel.ParameterType.Enum), valueText],
			callback: parameterFeedbackCallback(self, state, FeedbackId.ENUM),
			unsubscribe: unsubscribeParameterFeedback(self),
			learn: learnParameterFeedbackOptions(state, FeedbackId.ENUM),
		},
		[FeedbackId.Boolean]: {
			name: 'Parameter True (Deprecated)',
			description: `Checks the current value of a parameter is true. ${deprecated}`,
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [pathChoices(state, EmberModel.ParameterType.Boolean)],
			callback: parameterFeedbackCallback(self, state, FeedbackId.Boolean),
			unsubscribe: unsubscribeParameterFeedback(self),
		},
		[FeedbackId.ParameterProperty]: {
			name: 'Parameter Property',
			description: 'Return a property of a parameter, such as its value, to a local variable',
			type: 'value',
			options: [pathChoices(state), propertyDropdown, valueFeedbackInfo],
			callback: parameterPropertyFeedbackCallback(self, state),
			unsubscribe: unsubscribeParameterFeedback(self),
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
			options: [matrixNumber, { ...signalNumber, label: 'Value', id: 'source' }],
			callback: (feedback) => {
				return state.selected.source == feedback.options.source && state.selected.matrix == feedback.options.matrix
			},
		},
		[FeedbackId.TargetBackgroundSelected]: {
			name: 'Target Background if Selected',
			description: 'Change Background of Target, when it is currently selected.',
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [matrixNumber, { ...signalNumber, label: 'Value', id: 'target' }],
			callback: (feedback) => {
				return state.selected.target == feedback.options.target && state.selected.matrix == feedback.options.matrix
			},
		},
	}
}
