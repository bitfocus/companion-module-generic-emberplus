import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { ActionId } from '../actions.js'
import { CompositeElementId } from '../composites.js'
import { displayedRange } from '../feedbacks/property.js'
import { EmberNumberRange } from '../ranges.js'
import {
	background,
	DIAL_COLOR,
	expression,
	fontSizeVariables,
	isReadWrite,
	known,
	local,
	nameText,
	parameterVariables,
	PATH,
	propertyVariable,
	simpleVariable,
	templateGroups,
	TEXT_VARIABLE,
	VALUE_VARIABLE,
	valueText,
	type Element,
	type Preset,
	type PresetAction,
	type PresetGroup,
	type PresetParameter,
	type PresetTemplate,
	type Presets,
} from './consts.js'

/**
 * A rotary's range, local variables to change on the button: `auto` (or anything that isn't a number) takes the
 * parameter's own range as displayed
 */
export const MIN_VARIABLE = 'min'
export const MAX_VARIABLE = 'max'
/** The parameter's own range and step, read from it as displayed */
export const RANGE_MIN_VARIABLE = 'range_min'
export const RANGE_MAX_VARIABLE = 'range_max'
export const UNIT_VARIABLE = 'unit'
/** Whether the dial works on a log scale, as a frequency does: a turn multiplies the value, and the arc is logarithmic */
export const LOG_VARIABLE = 'logarithmic'
/**
 * A linear dial's step, and its step while held (a push and turn), in the parameter's displayed units; `auto` (or
 * anything that isn't a number above 0) works one out from the parameter
 */
export const STEP_VARIABLE = 'step_size'
export const FINE_STEP_VARIABLE = 'step_size_fine'
/** A logarithmic dial's step, in divisions of a doubling, and while held: 3 is a third of an octave */
export const DIVISIONS_VARIABLE = 'step_divisions'
export const FINE_DIVISIONS_VARIABLE = 'step_divisions_fine'

/** What a step starts as: worked out from the parameter */
export const AUTO = 'auto'

/** A third of a doubling a detent, a 24th while held, as companion-module-generic-oca's frequency dials */
export const LOG_DIVISIONS = { coarse: 3, fine: 24 } as const

/** How many detents an `auto` linear dial takes from one end of its range to the other, and while held */
export const DETENTS = { coarse: 50, fine: 500 } as const

/**
 * The smallest value a logarithmic dial takes the log of, so a range reaching zero gives a very negative number rather
 * than -Infinity, which would leave the arc undrawable
 */
const LOG_FLOOR = 0.001

/**
 * Where a logarithmic step starts from when the value is too near zero to multiply: zero times anything is still zero,
 * so a dial there could never leave it
 */
const RATIO_FLOOR = 0.001

const VALUE = local(VALUE_VARIABLE)
/** An end of the range: the button's, where it is set to a number, or else the parameter's */
function rangeEnd(set: string, own: string): string {
	return `(${known(local(set))} ? ${local(set)} : ${local(own)})`
}
const MIN = rangeEnd(MIN_VARIABLE, RANGE_MIN_VARIABLE)
const MAX = rangeEnd(MAX_VARIABLE, RANGE_MAX_VARIABLE)
const UNIT = local(UNIT_VARIABLE)
const LOGARITHMIC = `bool(${local(LOG_VARIABLE)})`

/** `value` on the scale the arc is drawn against: logarithmic, so every doubling takes the same length, or linear */
export function dialScale(value: string): string {
	return `(${LOGARITHMIC} ? log(max(${LOG_FLOOR}, ${value})) : ${value})`
}

/** A step's variable where it is set to a number above 0, or else `auto`, worked out from the parameter */
function stepOrAuto(variable: string, auto: string): string {
	const set = local(variable)
	return `(${known(set)} && ${set} > 0 ? ${set} : ${auto})`
}

/**
 * The `auto` steps, from the parameter's range and step as displayed: held, its own step (an integer's 1 unless it
 * says otherwise), or else a 500th of the range; unheld, a 50th of the range, in whole steps of its own. A real's own
 * step counts only where it is smaller than the range, or every detent would go from end to end; an integer's always
 * does, as a step smaller than its own would be rounded away.
 */
const RANGE = `(${MAX} - ${MIN})`
function autoSteps(integer: boolean): { coarse: string; fine: string } {
	const hasUnit = integer ? `(${known(UNIT)} && ${UNIT} > 0)` : `(${known(UNIT)} && ${UNIT} > 0 && ${UNIT} < ${RANGE})`
	return {
		coarse: `(${hasUnit} ? ${UNIT} * max(1, round(${RANGE} / ${UNIT} / ${DETENTS.coarse})) : ${RANGE} / ${DETENTS.coarse})`,
		fine: `(${hasUnit} ? ${UNIT} : ${RANGE} / ${DETENTS.fine})`,
	}
}

/**
 * The value one detent `direction` from `value`, before it is held to the range. Linear: the step, or the fine step
 * while held, added or taken away. Logarithmic: multiplied or divided by `2 ^ (1 / divisions)`, exact both ways, so a
 * step up and back down returns where it started; a negative value divides where a positive one multiplies, so a turn
 * always moves the way it was turned, and one too near zero to multiply starts again from the floor (as
 * companion-module-generic-oca's ratio steps).
 */
export function steppedValue(value: string, direction: 'up' | 'down', integer: boolean): string {
	const auto = autoSteps(integer)
	const step = `($(this:active) ? ${stepOrAuto(FINE_STEP_VARIABLE, auto.fine)} : ${stepOrAuto(STEP_VARIABLE, auto.coarse)})`
	const linear = `${value} ${direction === 'up' ? '+' : '-'} ${step}`
	const divisions = `($(this:active) ? ${local(FINE_DIVISIONS_VARIABLE)} : ${local(DIVISIONS_VARIABLE)})`
	const factor = `pow(2, 1 / ${divisions})`
	const [grow, shrink] = direction === 'up' ? [`* ${factor}`, `/ ${factor}`] : [`/ ${factor}`, `* ${factor}`]
	const escape = direction === 'up' ? RATIO_FLOOR : -RATIO_FLOOR
	const ratio =
		`(${value} >= ${RATIO_FLOOR} ? ${value} ${grow} : ` +
		`(${value} <= ${-RATIO_FLOOR} ? ${value} ${shrink} : ${escape}))`
	return `(${LOGARITHMIC} ? ${ratio} : ${linear})`
}

/**
 * What a turn sets: one detent from the current value, held to the range. Until the value and the range are known, it
 * is a word, not a number, so Companion skips the action rather than step from nothing, or hold it to nothing
 */
export function turned(direction: 'left' | 'right', integer: boolean): string {
	const stepped = steppedValue(VALUE, direction === 'right' ? 'up' : 'down', integer)
	const held = direction === 'right' ? `min(${MAX}, ${stepped})` : `max(${MIN}, ${stepped})`
	return `${known(VALUE)} && ${known(MIN)} && ${known(MAX)} ? ${held} : 'unknown'`
}

/** The dial's arc, between the range, on the scale given */
function dial(scaled: (value: string) => string): Element {
	return {
		type: 'composite',
		id: 'dial',
		name: 'Value Dial',
		elementId: CompositeElementId.Dial,
		options: {
			level: expression(scaled(VALUE)),
			min: expression(scaled(MIN)),
			max: expression(scaled(MAX)),
			color: DIAL_COLOR,
			scheme: 'single',
		},
	}
}

/** The dial, its value as text in the middle, and the parameter's path along the bottom, in the gap the arc leaves */
function rotaryElements(scaled: (value: string) => string): Element[] {
	return [background(), dial(scaled), valueText(`${local(TEXT_VARIABLE)} ?? ''`), nameText()]
}

/** The parameter's range, from Parameter Property as displayed, and the button's, `auto` to take the parameter's */
const RANGE_VARIABLES = [
	propertyVariable(RANGE_MIN_VARIABLE, 'displayedMinimum'),
	propertyVariable(RANGE_MAX_VARIABLE, 'displayedMaximum'),
	simpleVariable(MIN_VARIABLE, AUTO),
	simpleVariable(MAX_VARIABLE, AUTO),
]

/**
 * A rotary for an integer or real parameter. A turn sets the value as displayed, from the Value as Displayed property
 * (by formula, or else factor, as the Set Value actions take it), stepped and held to the range as displayed; the arc
 * is in displayed units too, and the text is Value with Units. Linear unless `logarithmic` is set on the button.
 */
function numberPreset(type: EmberModel.ParameterType.Integer | EmberModel.ParameterType.Real): Preset {
	// A relative change's limits, which an absolute one doesn't read: the range Ember+ allows the type, the defaults
	const { min, max } = EmberNumberRange[type]
	const setTo = (direction: 'left' | 'right'): PresetAction => {
		const value = expression(turned(direction, type === EmberModel.ParameterType.Integer))
		return type === EmberModel.ParameterType.Integer
			? {
					actionId: ActionId.SetValueInt,
					options: { path: PATH, value, relative: false, min, max, deviceUnits: false, factor: 1 },
				}
			: { actionId: ActionId.SetValueReal, options: { path: PATH, value, relative: false, min, max } }
	}
	return {
		type: 'layered',
		name: type === EmberModel.ParameterType.Integer ? 'Rotary (Integer)' : 'Rotary (Real)',
		elements: rotaryElements(dialScale),
		steps: [{ down: [], up: [], rotate_left: [setTo('left')], rotate_right: [setTo('right')] }],
		feedbacks: [],
		localVariables: [
			...parameterVariables(),
			propertyVariable(VALUE_VARIABLE, 'displayed'),
			propertyVariable(TEXT_VARIABLE, 'units'),
			...RANGE_VARIABLES,
			propertyVariable(UNIT_VARIABLE, 'displayedStep'),
			simpleVariable(LOG_VARIABLE, false),
			simpleVariable(STEP_VARIABLE, AUTO),
			simpleVariable(FINE_STEP_VARIABLE, AUTO),
			simpleVariable(DIVISIONS_VARIABLE, LOG_DIVISIONS.coarse),
			simpleVariable(FINE_DIVISIONS_VARIABLE, LOG_DIVISIONS.fine),
			...fontSizeVariables(),
		],
	}
}

/**
 * A rotary for an enumeration, stepping one entry a turn with Set Value ENUM's relative change, which goes through the
 * entries in order, within the range (its minimum and maximum, or else its first and last entry). The text is the
 * entry's name; the arc shows where the value sits in the range.
 */
function enumPreset(): Preset {
	const setTo = (value: number): PresetAction => ({
		actionId: ActionId.SetValueEnum,
		options: {
			path: PATH,
			value,
			asEnum: false,
			enumValue: '',
			relative: true,
			min: expression(MIN),
			max: expression(MAX),
		},
	})
	return {
		type: 'layered',
		name: 'Rotary (Enumeration)',
		elements: rotaryElements((value) => value),
		steps: [{ down: [], up: [], rotate_left: [setTo(-1)], rotate_right: [setTo(1)] }],
		feedbacks: [],
		localVariables: [
			...parameterVariables(),
			propertyVariable(VALUE_VARIABLE, 'value'),
			propertyVariable(TEXT_VARIABLE, 'enumeration'),
			...RANGE_VARIABLES,
			...fontSizeVariables(),
		],
	}
}

/** A parameter of a type that can be set, with a range */
function settable(type: EmberModel.ParameterType): (entry: PresetParameter) => boolean {
	return ({ parameter }) =>
		parameter.parameterType === type && isReadWrite(parameter) && displayedRange(parameter) !== undefined
}

export const ROTARY_TEMPLATES: readonly PresetTemplate[] = [
	{
		id: 'rotary_integer',
		preset: numberPreset(EmberModel.ParameterType.Integer),
		accepts: settable(EmberModel.ParameterType.Integer),
	},
	{
		id: 'rotary_real',
		preset: numberPreset(EmberModel.ParameterType.Real),
		accepts: settable(EmberModel.ParameterType.Real),
	},
	{ id: 'rotary_enumeration', preset: enumPreset(), accepts: settable(EmberModel.ParameterType.Enum) },
]

/**
 * A rotary for each integer, real and enumeration parameter that can be set and has a range, grouped by its parent
 * node
 */
export function getRotaryGroups(parameters: readonly PresetParameter[], presets: Presets): PresetGroup[] {
	return templateGroups(ROTARY_TEMPLATES, parameters, presets)
}
