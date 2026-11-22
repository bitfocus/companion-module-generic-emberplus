import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { ActionId } from '../actions.js'
import { CompositeElementId } from '../composites.js'
import { enumEntries } from '../enums.js'
import { EmberNumberRange } from '../ranges.js'
import {
	background,
	DIAL_COLOR,
	displayed,
	expression,
	fontSizeVariables,
	isReadWrite,
	known,
	local,
	nameText,
	parameterGroups,
	propertyVariable,
	simpleVariable,
	TEXT_VARIABLE,
	tidy,
	VALUE_VARIABLE,
	valueText,
	type Element,
	type LocalVariable,
	type Preset,
	type PresetAction,
	type PresetGroup,
	type PresetParameter,
	type Presets,
} from './consts.js'

/** The local variables of a rotary's range, and of its steps */
export const MIN_VARIABLE = 'min'
export const MAX_VARIABLE = 'max'
/** Whether the dial works on a log scale, as a frequency does: a turn multiplies the value, and the arc is logarithmic */
export const LOG_VARIABLE = 'logarithmic'
/** A linear dial's step, and its step while held (a push and turn), in the parameter's displayed units */
export const STEP_VARIABLE = 'step_size'
export const FINE_STEP_VARIABLE = 'step_size_fine'
/** A logarithmic dial's step, in divisions of a doubling, and while held: 3 is a third of an octave */
export const DIVISIONS_VARIABLE = 'step_divisions'
export const FINE_DIVISIONS_VARIABLE = 'step_divisions_fine'

/** A third of a doubling a detent, a 24th while held, as companion-module-generic-oca's frequency dials */
export const LOG_DIVISIONS = { coarse: 3, fine: 24 } as const

/** How many detents a linear dial takes from one end of its range to the other, and while held */
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
const MIN = local(MIN_VARIABLE)
const MAX = local(MAX_VARIABLE)
const LOGARITHMIC = `bool(${local(LOG_VARIABLE)})`

/** `value` on the scale the arc is drawn against: logarithmic, so every doubling takes the same length, or linear */
export function dialScale(value: string): string {
	return `(${LOGARITHMIC} ? log(max(${LOG_FLOOR}, ${value})) : ${value})`
}

/**
 * The value one detent `direction` from `value`, before it is held to the range. Linear: the step, or the fine step
 * while held, added or taken away. Logarithmic: multiplied or divided by `2 ^ (1 / divisions)`, exact both ways, so a
 * step up and back down returns where it started; a negative value divides where a positive one multiplies, so a turn
 * always moves the way it was turned, and one too near zero to multiply starts again from the floor (as
 * companion-module-generic-oca's ratio steps).
 */
export function steppedValue(value: string, direction: 'up' | 'down'): string {
	const step = `($(this:active) ? ${local(FINE_STEP_VARIABLE)} : ${local(STEP_VARIABLE)})`
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
 * What a turn sets: one detent from the current value, held to the range. Until the value is known it is a word, not a
 * number, so Companion skips the action rather than step from nothing
 */
export function turned(direction: 'left' | 'right'): string {
	const stepped = steppedValue(VALUE, direction === 'right' ? 'up' : 'down')
	const held = direction === 'right' ? `min(${MAX}, ${stepped})` : `max(${MIN}, ${stepped})`
	return `${known(VALUE)} ? ${held} : 'unknown'`
}

/** The dial's arc, from the range's local variables, on the scale the dial is set to */
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
function rotaryElements(name: string, scaled: (value: string) => string): Element[] {
	return [background(), dial(scaled), valueText(`${local(TEXT_VARIABLE)} ?? ''`), nameText(name)]
}

/**
 * A number parameter's range as displayed, lower first (a formula may turn it round); undefined for a parameter
 * without both limits, or a formula that can't compute them
 */
function displayedRange(parameter: EmberModel.Parameter): [number, number] | undefined {
	const { minimum, maximum } = parameter
	if (typeof minimum !== 'number' || typeof maximum !== 'number') return undefined
	const [low, high] = [displayed(parameter, minimum), displayed(parameter, maximum)]
	if (low === undefined || high === undefined || low === high) return undefined
	return [Math.min(low, high), Math.max(low, high)]
}

/**
 * A linear dial's steps as displayed: a fine step of the parameter's own step (an integer's being 1 unless it says
 * otherwise), or a 500th of the range for a real without one; and a coarse step of a 50th of the range, an integer's a
 * whole number of fine steps, a real's ten of its own step
 */
export function linearSteps(
	parameter: EmberModel.Parameter,
	[low, high]: [number, number],
): { coarse: number; fine: number } {
	const range = high - low
	const integer = parameter.parameterType === EmberModel.ParameterType.Integer
	const own = parameter.step ?? (integer ? 1 : undefined)
	const origin = parameter.minimum ?? 0
	const shown = own === undefined ? undefined : displayed(parameter, origin + own)
	const fromOrigin = displayed(parameter, origin)
	const stepped = shown === undefined || fromOrigin === undefined ? undefined : Math.abs(shown - fromOrigin)
	const fine = stepped && stepped < range ? stepped : range / DETENTS.fine
	const coarse = !stepped
		? range / DETENTS.coarse
		: integer
			? fine * Math.max(1, Math.round(range / fine / DETENTS.coarse))
			: Math.min(fine * 10, range)
	return { coarse: tidy(coarse), fine: tidy(fine) }
}

/** The range's local variables, there to narrow on the button */
function rangeVariables([low, high]: [number, number]): LocalVariable[] {
	return [simpleVariable(MIN_VARIABLE, tidy(low)), simpleVariable(MAX_VARIABLE, tidy(high))]
}

/**
 * A rotary for an integer or real parameter. A turn sets the value as displayed, from the Value as Displayed property
 * (by formula, or else factor, as the Set Value actions take it), stepped and held to the range; the arc and the range
 * are in displayed units too, and the text is Value with Units. Linear unless `logarithmic` is set on the button.
 */
function numberPreset(entry: PresetParameter): Preset | undefined {
	const { path, parameter, name } = entry
	const type = parameter.parameterType
	if (type !== EmberModel.ParameterType.Integer && type !== EmberModel.ParameterType.Real) return undefined
	const range = displayedRange(parameter)
	if (!range) return undefined
	const steps = linearSteps(parameter, range)
	// A relative change's limits, which an absolute one doesn't read: the range Ember+ allows the type, the defaults
	const { min, max } = EmberNumberRange[type]
	const setTo = (direction: 'left' | 'right'): PresetAction => {
		const value = expression(turned(direction))
		return type === EmberModel.ParameterType.Integer
			? {
					actionId: ActionId.SetValueInt,
					options: { path, value, relative: false, min, max, deviceUnits: false, factor: 1 },
				}
			: { actionId: ActionId.SetValueReal, options: { path, value, relative: false, min, max } }
	}
	return {
		type: 'layered',
		name,
		elements: rotaryElements(name, dialScale),
		steps: [{ down: [], up: [], rotate_left: [setTo('left')], rotate_right: [setTo('right')] }],
		feedbacks: [],
		localVariables: [
			propertyVariable(VALUE_VARIABLE, path, 'displayed'),
			propertyVariable(TEXT_VARIABLE, path, 'units'),
			...rangeVariables(range),
			simpleVariable(LOG_VARIABLE, false),
			simpleVariable(STEP_VARIABLE, steps.coarse),
			simpleVariable(FINE_STEP_VARIABLE, steps.fine),
			simpleVariable(DIVISIONS_VARIABLE, LOG_DIVISIONS.coarse),
			simpleVariable(FINE_DIVISIONS_VARIABLE, LOG_DIVISIONS.fine),
			...fontSizeVariables(),
		],
	}
}

/**
 * An enumeration's range: its minimum and maximum, or else its first and last entry's value (an enumeration's entries
 * give its range where it states none); undefined for one with neither
 */
function enumRange(parameter: EmberModel.Parameter): [number, number] | undefined {
	const values = enumEntries(parameter).map((entry) => entry.value)
	const low =
		typeof parameter.minimum === 'number' ? parameter.minimum : values.length ? Math.min(...values) : undefined
	const high =
		typeof parameter.maximum === 'number' ? parameter.maximum : values.length ? Math.max(...values) : undefined
	if (low === undefined || high === undefined || low >= high) return undefined
	return [low, high]
}

/**
 * A rotary for an enumeration, stepping one entry a turn with Set Value ENUM's relative change, which goes through the
 * entries in order, within the range. The text is the entry's name; the arc shows where the value sits in the range.
 */
function enumPreset({ path, parameter, name }: PresetParameter): Preset | undefined {
	if (parameter.parameterType !== EmberModel.ParameterType.Enum) return undefined
	const range = enumRange(parameter)
	if (!range) return undefined
	const setTo = (value: number): PresetAction => ({
		actionId: ActionId.SetValueEnum,
		options: {
			path,
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
		name,
		elements: rotaryElements(name, (value) => value),
		steps: [{ down: [], up: [], rotate_left: [setTo(-1)], rotate_right: [setTo(1)] }],
		feedbacks: [],
		localVariables: [
			propertyVariable(VALUE_VARIABLE, path, 'value'),
			propertyVariable(TEXT_VARIABLE, path, 'enumeration'),
			...rangeVariables(range),
			...fontSizeVariables(),
		],
	}
}

/**
 * A rotary for each integer, real and enumeration parameter that can be set and has a range, grouped by its parent
 * node
 */
export function getRotaryGroups(parameters: readonly PresetParameter[], presets: Presets): PresetGroup[] {
	const settable = parameters.filter(({ parameter }) => isReadWrite(parameter))
	return parameterGroups('rotary', settable, (entry) => numberPreset(entry) ?? enumPreset(entry), presets)
}
