import { CompositeElementId, METER_DEFAULT_COLOR, METER_PADDING } from '../composites.js'
import { isStreamParameter } from '../util.js'
import {
	background,
	expression,
	fontSizeVariables,
	isReadable,
	known,
	local,
	nameText,
	parameterVariables,
	propertyVariable,
	simpleVariable,
	templateGroups,
	TEXT_VARIABLE,
	VALUE_VARIABLE,
	valueText,
	type Preset,
	type PresetGroup,
	type PresetParameter,
	type PresetTemplate,
	type Presets,
} from './consts.js'

/**
 * The meter's range, local variables to change on the button: `auto` (or anything that isn't a number) takes the
 * parameter's own range as displayed, or else METER_DEFAULT_RANGE
 */
export const METER_MIN_VARIABLE = 'meter_min'
export const METER_MAX_VARIABLE = 'meter_max'
/** The parameter's own range, from Parameter Property as displayed */
export const RANGE_MIN_VARIABLE = 'range_min'
export const RANGE_MAX_VARIABLE = 'range_max'

/** What the range starts as: the parameter's own */
export const AUTO = 'auto'

/** The range a meter takes when its parameter doesn't give one, in dB */
export const METER_DEFAULT_RANGE = { min: -100, max: 0 } as const

/** An end of the meter's range: the button's, where it is set to a number, or else the parameter's, or else the default */
function meterEnd(set: string, own: string, fallback: number): string {
	return `(${known(local(set))} ? ${local(set)} : (${known(local(own))} ? ${local(own)} : ${fallback}))`
}

/**
 * A level meter for a stream parameter, such as an audio meter: a bar along the bottom, its level as displayed, from
 * the Value as Displayed property; the parameter's path by identifiers in the middle, and the level with its unit at
 * the top. Nothing here writes to the device, so the button has no actions. The Parameter Property feedbacks reading
 * it keep the stream subscribed while the button is there.
 */
const meterPreset: Preset = {
	type: 'layered',
	name: 'Meter',
	elements: [
		background(),
		valueText(`${local(TEXT_VARIABLE)} ?? ''`, 'top'),
		nameText('center'),
		{
			type: 'composite',
			id: 'meter',
			name: 'Signal Meter',
			elementId: CompositeElementId.Meter,
			options: {
				level: expression(local(VALUE_VARIABLE)),
				min: expression(meterEnd(METER_MIN_VARIABLE, RANGE_MIN_VARIABLE, METER_DEFAULT_RANGE.min)),
				max: expression(meterEnd(METER_MAX_VARIABLE, RANGE_MAX_VARIABLE, METER_DEFAULT_RANGE.max)),
				position: 'bottom',
				padding: METER_PADDING,
				scheme: 'meter',
				color: METER_DEFAULT_COLOR,
			},
		},
	],
	steps: [{ down: [], up: [] }],
	feedbacks: [],
	localVariables: [
		...parameterVariables(),
		propertyVariable(VALUE_VARIABLE, 'displayed'),
		propertyVariable(TEXT_VARIABLE, 'units'),
		propertyVariable(RANGE_MIN_VARIABLE, 'displayedMinimum'),
		propertyVariable(RANGE_MAX_VARIABLE, 'displayedMaximum'),
		simpleVariable(METER_MIN_VARIABLE, AUTO),
		simpleVariable(METER_MAX_VARIABLE, AUTO),
		...fontSizeVariables(),
	],
}

export const METER_TEMPLATES: readonly PresetTemplate[] = [
	{
		id: 'meter',
		preset: meterPreset,
		accepts: ({ parameter }) => isStreamParameter(parameter) && isReadable(parameter),
	},
]

/** A meter for each stream parameter, grouped by its parent node */
export function getMeterGroups(parameters: readonly PresetParameter[], presets: Presets): PresetGroup[] {
	return templateGroups(METER_TEMPLATES, parameters, presets)
}
