import { combineRgb, type CompanionPresetDefinitions, type CompanionPresetSection } from '@companion-module/base'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedback.js'
import type { ModuleTypes } from './index.js'

export enum PresetId {
	Take = 'take',
	Clear = 'clear',
}

export function GetPresetsList(): {
	structure: CompanionPresetSection<ModuleTypes>[]
	presets: CompanionPresetDefinitions<ModuleTypes>
} {
	const presets: CompanionPresetDefinitions<ModuleTypes> = {
		[PresetId.Take]: {
			type: 'simple',
			name: 'Take',
			style: {
				text: 'Take',
				size: 18,
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.Take,
					style: {
						bgcolor: combineRgb(255, 0, 0),
						color: combineRgb(255, 255, 255),
					},
					options: {},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.Take,
							options: {},
						},
					],
					up: [],
				},
			],
		},
		[PresetId.Clear]: {
			type: 'simple',
			name: 'Clear',
			style: {
				text: 'Clear',
				size: 18,
				color: combineRgb(128, 128, 128),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: FeedbackId.Clear,
					style: {
						bgcolor: combineRgb(255, 255, 255),
						color: combineRgb(255, 0, 0),
					},
					options: {},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionId.Clear,
							options: {},
						},
					],
					up: [],
				},
			],
		},
	}

	const structure: CompanionPresetSection<ModuleTypes>[] = [
		{
			id: 'matrix',
			name: 'Actions (XY only)',
			definitions: [PresetId.Take, PresetId.Clear],
		},
	]

	return { structure, presets }
}
