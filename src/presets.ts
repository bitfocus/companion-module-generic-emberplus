import { combineRgb, type CompanionPresetDefinitions, type CompanionPresetSection } from '@companion-module/base'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedback.js'
import type { ModuleTypes } from './index.js'
import { logger, presetParameters } from './presets/consts.js'
import { getMeterGroups } from './presets/meters.js'
import { getRotaryGroups } from './presets/rotaries.js'
import { getToggleGroups } from './presets/toggles.js'
import type { EmberPlusState } from './state.js'

export enum PresetId {
	Take = 'take',
	Clear = 'clear',
}

/**
 * The presets: a toggle, rotary or meter for each registered parameter that suits one (see presets/), in a section
 * each, grouped by parent node; and the XY matrix buttons. A section with nothing in it is left out. The parameter
 * presets follow what the module has registered: the configured paths, and those the actions and feedbacks use.
 */
export function GetPresetsList(state: EmberPlusState): {
	structure: CompanionPresetSection<ModuleTypes>[]
	presets: CompanionPresetDefinitions<ModuleTypes>
} {
	const parameters = presetParameters(state)
	const presets: CompanionPresetDefinitions<ModuleTypes> = {}
	const parameterSections: CompanionPresetSection<ModuleTypes>[] = [
		{ id: 'toggles', name: 'Toggles', definitions: getToggleGroups(parameters, presets) },
		{ id: 'rotaries', name: 'Rotaries', definitions: getRotaryGroups(parameters, presets) },
		{ id: 'meters', name: 'Meters', definitions: getMeterGroups(parameters, presets) },
	]
	logger.debug(`${Object.keys(presets).length} parameter presets, from ${parameters.length} parameters`)

	Object.assign(presets, {
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
	} satisfies CompanionPresetDefinitions<ModuleTypes>)

	const structure: CompanionPresetSection<ModuleTypes>[] = [
		...parameterSections.filter((section) => section.definitions.length > 0),
		{
			id: 'matrix',
			name: 'Actions (XY only)',
			definitions: [PresetId.Take, PresetId.Clear],
		},
	]

	return { structure, presets }
}
