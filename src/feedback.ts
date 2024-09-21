import { combineRgb /*InstanceBase*/ } from '@companion-module/base'
import type { CompanionFeedbackDefinition, CompanionFeedbackDefinitions, DropdownChoice } from '@companion-module/base'
import type { EmberPlusInstance } from './index'
import { EmberClient } from 'emberplus-connection'
import { resolvePath } from './actions'
import type { EmberPlusConfig } from './config'
import { EmberPlusState } from './state'

export enum FeedbackId {
	Parameter = 'parameter',
	String = 'string',
	Take = 'take',
	Clear = 'clear',
	SourceBackgroundSelected = 'sourceBackgroundSelected',
	TargetBackgroundSelected = 'targetBackgroundSelected',
}

export function GetFeedbacksList(
	_self: EmberPlusInstance, //InstanceBase<EmberPlusConfig>,
	_emberClient: EmberClient,
	config: EmberPlusConfig,
	state: EmberPlusState,
): CompanionFeedbackDefinitions {
	const feedbacks: { [id in FeedbackId]: CompanionFeedbackDefinition | undefined } = {
		[FeedbackId.Parameter]: {
			name: 'Parameter Equals',
			description: 'Checks the current value of a paramter',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 255),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Select registered path',
					id: 'path',
					choices: config.monitoredParameters?.map((item) => <DropdownChoice>{ id: item, label: item }) ?? [],
					default: config.monitoredParameters?.find(() => true) ?? 'No paths configured!',
					allowCustom: true,
				},
				{
					type: 'number',
					label: 'Value',
					id: 'value',
					required: true,
					min: -0xffffffff,
					max: 0xffffffff,
					default: 0,
				},
			],
			callback: async (feedback, context) => {
				const path = await resolvePath(context, feedback.options['path']?.toString() ?? '')
				return state.parameters.get(path) == feedback.options['value']?.toString()
			},
			subscribe: async (feedback, context) => {
				await _self.registerNewParameter(await resolvePath(context, feedback.options['path']?.toString() ?? ''))
			},
		},
		[FeedbackId.String]: {
			name: 'Parameter Equals String',
			description: 'Checks the current value of a paramter against a String',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 255),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Select registered path',
					id: 'path',
					choices: config.monitoredParameters?.map((item) => <DropdownChoice>{ id: item, label: item }) ?? [],
					default: config.monitoredParameters?.find(() => true) ?? 'No paths configured!',
					allowCustom: true,
				},
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					required: true,
					useVariables: true,
					default: '0',
				},
			],
			callback: async (feedback, context) => {
				const path = await resolvePath(
					_self,
					await context.parseVariablesInString(feedback.options['path']?.toString() ?? ''),
				)
				const value: string = await context.parseVariablesInString(feedback.options['value']?.toString() ?? '')
				return state.parameters.get(path) == value
			},
			subscribe: async (feedback, context) => {
				await _self.registerNewParameter(await resolvePath(context, feedback.options['path']?.toString() ?? ''))
			},
		},
		[FeedbackId.Take]: {
			name: 'Take is possible',
			description: 'Shows if there is take possible',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 255),
				color: combineRgb(255, 0, 0),
			},
			options: [],
			callback: () => {
				return state.selected.target != -1 && state.selected.source != -1 && state.selected.matrix != -1
			},
		},
		[FeedbackId.Clear]: {
			name: 'Clear is possible',
			description: 'Changes when a selection is made.',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 255),
				color: combineRgb(255, 0, 0),
			},
			options: [],
			callback: () => {
				return state.selected.target != -1 || state.selected.source != -1 || state.selected.matrix != -1
			},
		},
		[FeedbackId.SourceBackgroundSelected]: {
			name: 'Source Background If Selected',
			description: 'Change Background of Source, when it is currently selected.',
			type: 'boolean',
			defaultStyle: {
				// The default style change for a boolean feedback
				// The user will be able to customise these values as well as the fields that will be changed
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(0, 0, 0),
			},
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
			defaultStyle: {
				// The default style change for a boolean feedback
				// The user will be able to customise these values as well as the fields that will be changed
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(0, 0, 0),
			},
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
			callback: (feedback) => {
				return (
					state.selected.target == feedback.options['target'] && state.selected.matrix == feedback.options['matrix']
				)
			},
		},
	}

	return feedbacks
}
