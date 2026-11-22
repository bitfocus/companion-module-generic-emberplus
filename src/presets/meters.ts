import { CompositeElementId, METER_DEFAULT_COLOR, METER_PADDING } from '../composites.js'
import { isStreamParameter } from '../util.js'
import {
	background,
	displayed,
	expression,
	fontSizeVariables,
	isReadable,
	local,
	nameText,
	parameterGroups,
	propertyVariable,
	simpleVariable,
	TEXT_VARIABLE,
	tidy,
	VALUE_VARIABLE,
	valueText,
	type Preset,
	type PresetGroup,
	type PresetParameter,
	type Presets,
} from './consts.js'

/** The meter's range, as local variables to change on the button */
export const METER_MIN_VARIABLE = 'meter_min'
export const METER_MAX_VARIABLE = 'meter_max'

/** The range a meter starts with when its parameter doesn't give both limits, in dB */
export const METER_DEFAULT_RANGE = { min: -100, max: 0 } as const

/**
 * A meter's range as displayed: the parameter's limits, by its formula (a meter's in dB), or else factor, lower
 * first; or else -100 to 0, for one without both, or a formula that can't compute them
 */
export function meterRange(entry: PresetParameter): { min: number; max: number } {
	const { minimum, maximum } = entry.parameter
	if (typeof minimum === 'number' && typeof maximum === 'number') {
		const [low, high] = [displayed(entry.parameter, minimum), displayed(entry.parameter, maximum)]
		if (low !== undefined && high !== undefined && low !== high) {
			return { min: tidy(Math.min(low, high)), max: tidy(Math.max(low, high)) }
		}
	}
	return { ...METER_DEFAULT_RANGE }
}

/**
 * A level meter for a stream parameter, such as an audio meter: a bar along the bottom, its level as displayed, from
 * the Value as Displayed property, between the range's local variables; the parameter's path by identifiers in the
 * middle, and the level with its unit at the top. Nothing here writes to the device, so the button has no actions. The
 * Parameter Property feedbacks reading it keep the stream subscribed while the button is there.
 */
function meterPreset(entry: PresetParameter): Preset | undefined {
	const { path, parameter, name } = entry
	if (!isStreamParameter(parameter) || !isReadable(parameter)) return undefined
	const range = meterRange(entry)
	return {
		type: 'layered',
		name,
		elements: [
			background(),
			valueText(`${local(TEXT_VARIABLE)} ?? ''`, 'top'),
			nameText(name, 'center'),
			{
				type: 'composite',
				id: 'meter',
				name: 'Signal Meter',
				elementId: CompositeElementId.Meter,
				options: {
					level: expression(local(VALUE_VARIABLE)),
					min: expression(local(METER_MIN_VARIABLE)),
					max: expression(local(METER_MAX_VARIABLE)),
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
			propertyVariable(VALUE_VARIABLE, path, 'displayed'),
			propertyVariable(TEXT_VARIABLE, path, 'units'),
			simpleVariable(METER_MIN_VARIABLE, range.min),
			simpleVariable(METER_MAX_VARIABLE, range.max),
			...fontSizeVariables(),
		],
	}
}

/** A meter for each stream parameter, grouped by its parent node */
export function getMeterGroups(parameters: readonly PresetParameter[], presets: Presets): PresetGroup[] {
	return parameterGroups('meter', parameters, meterPreset, presets)
}
