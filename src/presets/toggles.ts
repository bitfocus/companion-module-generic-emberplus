import { combineRgb } from '@companion-module/base'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { ActionId } from '../actions.js'
import {
	activeOverrides,
	background,
	fontSizeVariables,
	isReadWrite,
	local,
	NAME_ID,
	nameText,
	parameterGroups,
	propertyVariable,
	VALUE_ID,
	VALUE_VARIABLE,
	valueText,
	type ActiveColors,
	type Preset,
	type PresetGroup,
	type PresetParameter,
	type Presets,
} from './consts.js'

/** Green while on, as companion-module-generic-oca's toggle for a boolean actuator */
export const TOGGLE_ACTIVE_COLORS: ActiveColors = { background: combineRgb(0, 153, 0) }

const VALUE = local(VALUE_VARIABLE)

/**
 * A button that toggles a boolean parameter, ON or OFF in the middle (nothing until the value is known), green while
 * on, its path by identifiers along the bottom. The Set Value Boolean action's toggle sets the opposite of the value
 * the module has, so a press before it is known sets true.
 */
function togglePreset({ path, parameter, name }: PresetParameter): Preset | undefined {
	if (parameter.parameterType !== EmberModel.ParameterType.Boolean || !isReadWrite(parameter)) return undefined
	return {
		type: 'layered',
		name,
		elements: [background(), valueText(`${VALUE} == true ? 'ON' : (${VALUE} == false ? 'OFF' : '')`), nameText(name)],
		steps: [
			{
				down: [{ actionId: ActionId.SetValueBoolean, options: { path, toggle: true, value: false } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'internal:checkExpression',
				options: { expression: `${VALUE} == true` },
				styleOverrides: activeOverrides(TOGGLE_ACTIVE_COLORS, [VALUE_ID, NAME_ID]),
			},
		],
		localVariables: [propertyVariable(VALUE_VARIABLE, path, 'value'), ...fontSizeVariables()],
	}
}

/** A toggle for each boolean parameter that can be set, grouped by its parent node */
export function getToggleGroups(parameters: readonly PresetParameter[], presets: Presets): PresetGroup[] {
	return parameterGroups('toggle', parameters, togglePreset, presets)
}
