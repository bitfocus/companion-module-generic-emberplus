import { combineRgb /*InstanceBase*/ } from '@companion-module/base'
import type {
	CompanionFeedbackDefinition,
	CompanionFeedbackDefinitions,
	CompanionFeedbackContext,
	CompanionFeedbackInfo,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
	CompanionInputFieldCheckbox,
	CompanionInputFieldNumber,
} from '@companion-module/base'
import type { EmberPlusInstance } from './index'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { resolvePath, factorOpt } from './actions'
import type { EmberPlusConfig } from './config'
import { EmberPlusState } from './state'
import { compareNumber, comparitorOptions, filterPathChoices, NumberComparitor } from './util'

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

async function resolveFeedbackPath(
	feedback: CompanionFeedbackInfo,
	context: CompanionFeedbackContext,
): Promise<string> {
	return await resolvePath(
		context,
		feedback.options['usePathVar']
			? (feedback.options['pathVar']?.toString() ?? '')
			: (feedback.options['path']?.toString() ?? ''),
	)
}

export async function resolveFeedback(
	self: EmberPlusInstance,
	context: CompanionFeedbackContext,
	state: EmberPlusState,
	type: EmberModel.ParameterType,
	path: string,
	value?: boolean | number | string,
	comparitor: NumberComparitor = NumberComparitor.Equal,
	factor: string = '1',
): Promise<boolean> {
	let fact = parseInt(await context.parseVariablesInString(factor))
	if (isNaN(fact)) fact = 1
	if (typeof value === 'string') {
		value = await context.parseVariablesInString(value)
	}
	if (state.parameters.has(path)) {
		switch (type) {
			case EmberModel.ParameterType.Boolean:
				return Boolean(state.parameters.get(path)?.value)
			case EmberModel.ParameterType.Real:
				return compareNumber(Number(value), comparitor, Number(state.parameters.get(path)?.value))
			case EmberModel.ParameterType.Integer:
				return compareNumber(
					Math.floor(Number(value) * fact),
					comparitor,
					Math.floor(Number(state.parameters.get(path)?.value)),
				)
			case EmberModel.ParameterType.Enum:
				return state.parameters.get(path)?.enumeration == value
			case EmberModel.ParameterType.String:
			default:
				return state.parameters.get(path)?.value?.toString() == value
		}
	} else {
		self.registerNewParameter(path).catch(() => {})
		return false
	}
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
					choices:
						filterPathChoices(
							state,
							EmberModel.ParameterType.Enum,
							EmberModel.ParameterType.Real,
							EmberModel.ParameterType.Integer,
						) ?? [],
					default:
						filterPathChoices(
							state,
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
			callback: async (feedback, context) => {
				return await resolveFeedback(
					self,
					context,
					state,
					feedback.options['asInt'] ? EmberModel.ParameterType.Integer : EmberModel.ParameterType.Real,
					await resolveFeedbackPath(feedback, context),
					feedback.options['useVar'] ? String(feedback.options['valueVar']) : Number(feedback.options['value']),
					feedback.options['comparitor'] as NumberComparitor,
					feedback.options['factor']?.toString() ?? '1',
				)
			},
			subscribe: async (feedback, context) => {
				await self.registerNewParameter(await resolveFeedbackPath(feedback, context))
			},
			learn: async (feedback, context) => {
				const path = await resolveFeedbackPath(feedback, context)
				if (state.parameters.has(path)) {
					const val = state.parameters.get(path)
					if (typeof val?.value !== 'number') return undefined
					return {
						...feedback.options,
						value: val.value,
						valueVar: val?.value.toString(),
						factor: val.factor ?? feedback.options.factor,
					}
				}
				return undefined
			},
		},
		[FeedbackId.String]: {
			name: 'Parameter Equals String',
			description: 'Checks the current value of a parameter against a String',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.String) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.String).find(() => true)?.id ?? 'No paths configured!',
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
			callback: async (feedback, context) => {
				return await resolveFeedback(
					self,
					context,
					state,
					EmberModel.ParameterType.String,
					await resolveFeedbackPath(feedback, context),
					feedback.options['value']?.toString() ?? '',
				)
			},
			subscribe: async (feedback, context) => {
				await self.registerNewParameter(await resolveFeedbackPath(feedback, context))
			},
			learn: async (feedback, context) => {
				const path = await resolveFeedbackPath(feedback, context)
				if (state.parameters.has(path)) {
					const val = state.parameters.get(path)?.value
					if (val === undefined) return undefined
					return {
						...feedback.options,
						value: val?.toString(),
					}
				}
				return undefined
			},
		},
		[FeedbackId.ENUM]: {
			name: 'Parameter ENUM Equals String',
			description: 'Checks the current Enumeration of an ENUM parameter against a String',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Enum) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Enum).find(() => true)?.id ?? 'No paths configured!',
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
			callback: async (feedback, context) => {
				return await resolveFeedback(
					self,
					context,
					state,
					EmberModel.ParameterType.Enum,
					await resolveFeedbackPath(feedback, context),
					feedback.options['value']?.toString() ?? '',
				)
			},
			subscribe: async (feedback, context) => {
				await self.registerNewParameter(await resolveFeedbackPath(feedback, context))
			},
			learn: async (feedback, context) => {
				const path = await resolveFeedbackPath(feedback, context)
				if (state.parameters.has(path)) {
					const val = state.parameters.get(path)?.enumeration
					if (val === undefined) return undefined
					return {
						...feedback.options,
						value: val?.toString(),
					}
				}
				return undefined
			},
		},
		[FeedbackId.Boolean]: {
			name: 'Parameter True',
			description: 'Checks the current value of a paramter is true',
			type: 'boolean',
			defaultStyle: styles.blackOnWhite,
			options: [
				{
					...pathDropDown,
					choices: filterPathChoices(state, EmberModel.ParameterType.Boolean) ?? [],
					default:
						filterPathChoices(state, EmberModel.ParameterType.Boolean).find(() => true)?.id ?? 'No paths configured!',
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
			callback: async (feedback, context) => {
				return await resolveFeedback(
					self,
					context,
					state,
					EmberModel.ParameterType.Boolean,
					await resolveFeedbackPath(feedback, context),
				)
			},
			subscribe: async (feedback, context) => {
				await self.registerNewParameter(await resolveFeedbackPath(feedback, context))
			},
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
