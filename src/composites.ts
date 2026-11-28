import {
	combineRgb,
	type ButtonGraphicsGaugeElement,
	type CompanionGraphicsCompositeElementDefinitions,
	type DropdownChoice,
	type SomeCompanionFeedbackInputField,
} from '@companion-module/base'
import type EmberPlusInstance from './index.js'

/**
 * Composite graphics elements this module offers for layered buttons, taken from companion-module-generic-oca
 * (2026-11-22), whose meter is modelled on the one in companion-module-turtleav-mineola, itself modelled on the
 * `vumeter` composite in companion-module-glensound-divine, with the same bar thickness, end inset and edge padding,
 * so meters from these modules line up on a page.
 *
 * Unlike mineola's and divine's, an Ember+ parameter reads in whatever unit the device gives it, over whatever span it
 * chooses (a meter in dB by its formula, a gain in its device's steps), so the meter's ends are options rather than
 * fixed at -60..0 dB, and the colour stops are placed across whatever range it is given.
 */
export enum CompositeElementId {
	Meter = 'meter',
	Dial = 'dial',
	CentredDial = 'centred_dial',
	WidthDial = 'width_dial',
}

/** Where a dial's arc grows from. */
type DialMode = 'minimum' | 'centred' | 'width'

export const MeterPosition = ['left', 'right', 'top', 'bottom'] as const
export type MeterPosition = (typeof MeterPosition)[number]

const POSITION_CHOICES = [
	{ id: 'left', label: 'Left' },
	{ id: 'right', label: 'Right' },
	{ id: 'top', label: 'Top' },
	{ id: 'bottom', label: 'Bottom' },
] as const satisfies DropdownChoice<MeterPosition>[]

/** How a meter is coloured: the audio metering scale, or one colour of the user's choosing. */
export const MeterScheme = ['meter', 'custom'] as const
export type MeterScheme = (typeof MeterScheme)[number]

const SCHEME_CHOICES = [
	{ id: 'meter', label: 'Audio metering' },
	{ id: 'custom', label: 'Single colour' },
] as const satisfies DropdownChoice<MeterScheme>[]

/** How a value dial is coloured: one colour, or the visible spectrum across its range. */
export const DialScheme = ['single', 'spectrum'] as const
export type DialScheme = (typeof DialScheme)[number]

const DIAL_SCHEME_CHOICES = [
	{ id: 'single', label: 'Single colour' },
	{ id: 'spectrum', label: 'Spectrum' },
] as const satisfies DropdownChoice<DialScheme>[]

export type CompositeElementSchema = {
	[CompositeElementId.Meter]: {
		options: {
			level: number
			min: number
			max: number
			position: MeterPosition
			padding: number
			scheme: MeterScheme
			color: number
		}
	}
	[CompositeElementId.Dial]: {
		options: { level: number; min: number; max: number; color: number; scheme: DialScheme }
	}
	[CompositeElementId.CentredDial]: {
		options: { level: number; min: number; max: number; color: number; colorZero: number; colorBelow: number }
	}
	[CompositeElementId.WidthDial]: {
		options: { level: number; min: number; max: number; color: number }
	}
}

/** Percentage of the button taken up by the short axis of the bar */
export const METER_THICKNESS = 8
/** Percentage inset at each end of the bar's long axis */
const METER_INSET = 6
const METER_LENGTH = 100 - METER_INSET * 2
/** Default distance of the bar from the edge of the button, as a percentage */
export const METER_PADDING = 2

/** The ends of the bar a meter gets until it is told otherwise, in dB: a full scale audio meter. */
export const METER_DEFAULT_MIN = -60
export const METER_DEFAULT_MAX = 0

/** The single colour a meter is drawn in when it isn't using the metering scale. */
export const METER_DEFAULT_COLOR = combineRgb(0, 204, 0)

/**
 * How much of its colour the unfilled part of the bar keeps, 0 - 100. At 100 it matches the fill and a silent
 * meter looks full scale; Companion's own default is 70.
 */
const METER_TRACK_AMOUNT = 20

/**
 * Colour stops, each a fraction of the way from the meter's min to its max, so the splits follow whatever
 * range the meter is given. Every stop is a gradient, so the gauge blends each colour into the next; the
 * last, red, has nothing to blend into and runs solid from 0.9 to the top of the bar.
 *
 * The fractions are where mineola's fixed stops fall on its -60..0 dB meter, so a meter left on the default
 * range is coloured identically to one of its.
 */
export const METER_STOPS = [
	{ at: 0, color: combineRgb(0, 100, 0) }, // dark green, -60 dB on the default range
	{ at: 1 / 3, color: combineRgb(0, 204, 0) }, // green, -40 dB
	{ at: 2 / 3, color: combineRgb(255, 255, 0) }, // yellow, -20 dB
	{ at: 0.8, color: combineRgb(255, 191, 0) }, // amber, -12 dB
	{ at: 0.9, color: combineRgb(255, 0, 0) }, // red, -6 dB
] as const

/**
 * Newton's spectrum, each colour a fraction of the way along the dial. Every stop blends into the
 * next, so the arc runs red through to violet rather than banding. On a frequency dial that reads
 * like the visible spectrum it is named after: low is red, high is violet.
 */
export const SPECTRUM_STOPS = [
	{ at: 0, color: combineRgb(255, 0, 0) }, // red
	{ at: 1 / 6, color: combineRgb(255, 127, 0) }, // orange
	{ at: 2 / 6, color: combineRgb(255, 255, 0) }, // yellow
	{ at: 3 / 6, color: combineRgb(0, 255, 0) }, // green
	{ at: 4 / 6, color: combineRgb(0, 0, 255) }, // blue
	{ at: 5 / 6, color: combineRgb(75, 0, 130) }, // indigo
	{ at: 1, color: combineRgb(148, 0, 211) }, // violet
] as const

/**
 * The dial's arc, as positions on a clock face. Companion measures a ring gauge's angles in degrees
 * clockwise from 12 o'clock, so an hour is 30 degrees. Running from 8 round through 12 to 4 sweeps 240
 * degrees and leaves the bottom 120 undrawn, which is where a knob's pointer never goes.
 */
const CLOCK_HOUR_DEGREES = 30
const DIAL_START_HOUR = 8
const DIAL_END_HOUR = 4

/** How thick the ring is, as a percentage of its radius. Companion allows 1 to 50. */
const DIAL_RING_WIDTH = 15

/**
 * How far the ring is held back from each edge of the button, as a percentage. At 0 the ring touches the
 * edge at 12, 3, 6 and 9 o'clock, since its radius is half the shorter side.
 */
const DIAL_PADDING = 5
const DIAL_DIAMETER = 100 - DIAL_PADDING * 2

/** How much colour the untravelled part of the arc keeps, so the dial still reads as one. */
const DIAL_TRACK_AMOUNT = 20

/**
 * How long the pan dial's marker bead is along the arc, as a percentage of the ring's thickness, so at 100
 * it is as long as the ring is thick and reads as a dot rather than a hairline. Companion's own default, 15,
 * would come out under a pixel and be clamped to one.
 */
const DIAL_MARKER_WIDTH = 100

/** `hour` on a clock face as a gauge angle. */
function clockAngle(hour: number): number {
	return (hour % 12) * CLOCK_HOUR_DEGREES
}

const POSITION = `$(options:position)`
const PADDING = `$(options:padding)`
const MIN = `$(options:min)`
const MAX = `$(options:max)`
const COLOR = `$(options:color)`
const COLOR_BELOW = `$(options:colorBelow)`
const COLOR_ZERO = `$(options:colorZero)`
const IS_VERTICAL = `(${POSITION} == 'left' || ${POSITION} == 'right')`
const IS_METERING = `$(options:scheme) == '${SCHEME_CHOICES[0].id}'`
const IS_SPECTRUM = `$(options:scheme) == '${DIAL_SCHEME_CHOICES[1].id}'`

/** Where `stop` sits on a bar running from the meter's min to its max. */
function stopValue(at: number): string {
	if (at === 0) return MIN
	return `${MIN} + (${MAX} - ${MIN}) * ${at}`
}

/** Halfway between the dial's ends, which a width dial grows out from. */
const MIDPOINT = `(${MIN} + ${MAX}) / 2`

/**
 * Zero, held inside the dial's range: where a centred dial's arc starts. On a range either side of
 * zero that is 12 o'clock when the ends match and offset when they don't, and on a range that never
 * reaches zero it lands on whichever end is nearer, so the arc grows from there like a plain dial.
 */
const ZERO_ORIGIN = `min(max(0, ${MIN}), ${MAX})`

type DialOption = keyof CompositeElementSchema[CompositeElementId.Dial]['options']
type WidthDialOption = keyof CompositeElementSchema[CompositeElementId.WidthDial]['options']
type CentredDialOption = keyof CompositeElementSchema[CompositeElementId.CentredDial]['options']

/**
 * The options every dial takes, differing only in what their ends mean and their colour. A centred
 * dial has a second colour for below zero, which is why the overloads separate the two: only its
 * schema carries that option.
 */
function dialOptions(
	mode: 'centred',
	minimumTooltip: string,
	defaultColor: number,
): SomeCompanionFeedbackInputField<CentredDialOption>[]
function dialOptions(
	mode: 'minimum',
	minimumTooltip: string,
	defaultColor: number,
): SomeCompanionFeedbackInputField<DialOption>[]
function dialOptions(
	mode: 'width',
	minimumTooltip: string,
	defaultColor: number,
): SomeCompanionFeedbackInputField<WidthDialOption>[]
function dialOptions(
	mode: DialMode,
	minimumTooltip: string,
	defaultColor: number,
): SomeCompanionFeedbackInputField<CentredDialOption | DialOption>[] {
	return [
		{
			type: 'number',
			label: 'Value',
			id: 'level',
			tooltip: "Set this to the parameter's value, e.g. $(local:gain) from a Parameter Property feedback",
			min: Number.MIN_SAFE_INTEGER,
			max: Number.MAX_SAFE_INTEGER,
			default: 0,
		},
		{
			type: 'number',
			label: 'Minimum',
			id: 'min',
			tooltip: minimumTooltip,
			min: Number.MIN_SAFE_INTEGER,
			max: Number.MAX_SAFE_INTEGER,
			default: 0,
		},
		{
			type: 'number',
			label: 'Maximum',
			id: 'max',
			tooltip: 'The value at the full end of the arc',
			min: Number.MIN_SAFE_INTEGER,
			max: Number.MAX_SAFE_INTEGER,
			default: 100,
		},
		{
			type: 'colorpicker',
			label: mode === 'centred' ? 'Colour above zero' : 'Colour',
			id: 'color',
			default: defaultColor,
			returnType: 'number',
		},
		// Only the value dial runs a scale along its arc; the others grow from a point
		...(mode === 'minimum'
			? [
					{
						type: 'dropdown' as const,
						label: 'Colours',
						id: 'scheme' as const,
						tooltip: 'A spectrum runs red to violet across the range, ignoring the colour above',
						choices: DIAL_SCHEME_CHOICES,
						default: DIAL_SCHEME_CHOICES[0].id,
					},
				]
			: []),
		// Only a centred dial has sides to tell apart. Leave all three the same for one colour throughout
		...(mode === 'centred'
			? [
					{
						type: 'colorpicker' as const,
						label: 'Colour at zero',
						id: 'colorZero' as const,
						tooltip: 'The arc blends from this out to the colour at each end of the range',
						default: defaultColor,
						returnType: 'number' as const,
					},
					{
						type: 'colorpicker' as const,
						label: 'Colour below zero',
						id: 'colorBelow' as const,
						tooltip: 'Set all three the same to draw the whole arc in one colour',
						default: defaultColor,
						returnType: 'number' as const,
					},
				]
			: []),
	]
}

/**
 * The ring every dial is drawn with, differing only in where its arc grows from:
 *
 * - `minimum` fills up from the empty end, like a level.
 * - `centred` fills out from zero, clockwise above it and anticlockwise below, so a range either side of
 *   zero reads as a pan or a cut-and-boost.
 * - `width` grows both ways at once from the middle of the range, so the minimum is a dot at 12 o'clock
 *   and the maximum fills the arc end to end. That is Companion's `symmetric` mode, where the fill is a
 *   band of the value's own length centred on the origin (`GaugeColorModel.ts:83-87`).
 *
 * Both of the latter carry a marker bead. The renderer draws that at the value whether or not there is any
 * fill (`LayeredRenderer.ts:794`), which is what leaves a dot behind when the two ends of the band meet.
 */
function dialGauge(mode: DialMode): ButtonGraphicsGaugeElement {
	const names: Record<DialMode, string> = { minimum: 'Dial', centred: 'Centred Dial', width: 'Width Dial' }
	return {
		type: 'gauge',
		name: names[mode],
		// The renderer centres the ring and takes its radius from the shorter side, so a square
		// inset from every edge stays circular, scales with whatever it is drawn on, and keeps
		// clear of the button's edges
		x: DIAL_PADDING,
		y: DIAL_PADDING,
		width: DIAL_DIAMETER,
		height: DIAL_DIAMETER,
		orientation: 'ring',
		startAngle: clockAngle(DIAL_START_HOUR),
		endAngle: clockAngle(DIAL_END_HOUR),
		ringWidth: DIAL_RING_WIDTH,
		roundedEnds: true,
		min: { isExpression: true, value: MIN },
		max: { isExpression: true, value: MAX },
		value: { isExpression: true, value: '$(options:level)' },
		fillEnabled: true,
		// A centred dial blends across its stops, so the arc shades away from zero; anywhere else the
		// fill is one colour, taken from the last stop at or below the value (`GaugeColorModel.ts:120`)
		multiColour: mode === 'centred' ? true : mode === 'minimum' ? { isExpression: true, value: IS_SPECTRUM } : false,
		// Three stops for a centred dial: the colour at zero blending out to each end of the range.
		// The renderer runs a gradient between consecutive stops, and the last has nothing to blend into
		stops:
			mode === 'centred'
				? [
						{
							value: { isExpression: true, value: MIN },
							color: { isExpression: true, value: COLOR_BELOW },
							gradient: true,
						},
						{
							value: { isExpression: true, value: ZERO_ORIGIN },
							color: { isExpression: true, value: COLOR_ZERO },
							gradient: true,
						},
						{
							value: { isExpression: true, value: MAX },
							color: { isExpression: true, value: COLOR },
							gradient: false,
						},
					]
				: mode === 'minimum'
					? SPECTRUM_STOPS.map((stop) => ({
							value: { isExpression: true as const, value: stopValue(stop.at) },
							color: { isExpression: true as const, value: `${IS_SPECTRUM} ? ${stop.color} : ${COLOR}` },
							// Blended on a spectrum; on a single colour every stop is the same, so it stays flat
							gradient: true,
						}))
					: [
							{
								value: { isExpression: true, value: MIN },
								color: { isExpression: true, value: COLOR },
								gradient: false,
							},
						],
		// The untravelled part of the arc stays faintly visible, so the dial reads as a dial
		trackStyle: 'dimmed',
		trackAmount: DIAL_TRACK_AMOUNT,
		...(mode === 'minimum'
			? {}
			: {
					origin: { isExpression: true, value: mode === 'width' ? MIDPOINT : ZERO_ORIGIN },
					...(mode === 'width' ? { symmetric: true } : {}),
					markerEnabled: true,
					// The dot takes the colour of the end it is heading for, and the zero colour when it
					// sits on zero with no fill either side of it
					markerColor: {
						isExpression: true,
						value:
							mode === 'centred'
								? `$(options:level) < ${ZERO_ORIGIN} ? ${COLOR_BELOW} : ($(options:level) > ${ZERO_ORIGIN} ? ${COLOR} : ${COLOR_ZERO})`
								: COLOR,
					},
					markerWidth: DIAL_MARKER_WIDTH,
				}),
	}
}

export function UpdateCompositeElements(self: EmberPlusInstance): void {
	const compositeElements: CompanionGraphicsCompositeElementDefinitions<CompositeElementSchema> = {
		[CompositeElementId.Meter]: {
			type: 'composite',
			name: 'Signal Meter',
			description:
				'A bargraph meter for a level, such as an audio meter. Feed it the level, e.g. a local variable driven by a Parameter Property feedback, and the ends of the range it should draw',
			options: [
				{
					type: 'number',
					label: 'Level',
					id: 'level',
					tooltip: 'Set this to the level, e.g. $(local:level) from a Parameter Property feedback',
					min: Number.MIN_SAFE_INTEGER,
					max: Number.MAX_SAFE_INTEGER,
					default: METER_DEFAULT_MIN,
				},
				{
					type: 'number',
					label: 'Minimum',
					id: 'min',
					tooltip: 'The level at the empty end of the bar',
					min: Number.MIN_SAFE_INTEGER,
					max: Number.MAX_SAFE_INTEGER,
					default: METER_DEFAULT_MIN,
				},
				{
					type: 'number',
					label: 'Maximum',
					id: 'max',
					tooltip: 'The level at the full end of the bar',
					min: Number.MIN_SAFE_INTEGER,
					max: Number.MAX_SAFE_INTEGER,
					default: METER_DEFAULT_MAX,
				},
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					choices: POSITION_CHOICES,
					default: POSITION_CHOICES[3].id,
				},
				{
					type: 'number',
					label: 'Padding',
					id: 'padding',
					tooltip: 'Distance from the edge of the button, as a percentage',
					min: 0,
					max: 40,
					default: METER_PADDING,
				},
				{
					type: 'dropdown',
					label: 'Colours',
					id: 'scheme',
					tooltip:
						'The metering scale runs green to red across the range; a single colour suits a value that is not a signal level',
					choices: SCHEME_CHOICES,
					default: SCHEME_CHOICES[0].id,
				},
				{
					type: 'colorpicker',
					label: 'Colour',
					id: 'color',
					tooltip: 'Used when Colours is set to a single colour',
					default: METER_DEFAULT_COLOR,
					returnType: 'number',
				},
			],
			elements: [
				{
					type: 'gauge',
					name: 'Meter',
					x: {
						isExpression: true,
						value: `${POSITION} == 'left' ? ${PADDING} : (${POSITION} == 'right' ? 100 - ${PADDING} - ${METER_THICKNESS} : ${METER_INSET})`,
					},
					y: {
						isExpression: true,
						value: `${POSITION} == 'top' ? ${PADDING} : (${POSITION} == 'bottom' ? 100 - ${PADDING} - ${METER_THICKNESS} : ${METER_INSET})`,
					},
					width: { isExpression: true, value: `${IS_VERTICAL} ? ${METER_THICKNESS} : ${METER_LENGTH}` },
					height: { isExpression: true, value: `${IS_VERTICAL} ? ${METER_LENGTH} : ${METER_THICKNESS}` },
					orientation: { isExpression: true, value: `${IS_VERTICAL} ? 'vertical' : 'horizontal'` },
					min: { isExpression: true, value: MIN },
					max: { isExpression: true, value: MAX },
					value: { isExpression: true, value: '$(options:level)' },
					fillEnabled: true,
					// Only the metering scale blends between its stops; a single colour is flat
					multiColour: { isExpression: true, value: IS_METERING },
					trackStyle: 'dimmed',
					trackAmount: METER_TRACK_AMOUNT,
					// The stops stay in place for either scheme. On a single colour they all resolve to it,
					// so whichever one the reading falls in, and whatever blending happens, the bar is that colour
					stops: METER_STOPS.map((stop) => ({
						value: { isExpression: true, value: stopValue(stop.at) },
						color: { isExpression: true, value: `${IS_METERING} ? ${stop.color} : ${COLOR}` },
						gradient: true,
					})),
				},
			],
		},
		[CompositeElementId.Dial]: {
			type: 'composite',
			name: 'Value Dial',
			description: `A knob-style arc running from ${DIAL_START_HOUR} o'clock up round to ${DIAL_END_HOUR}, filling from the minimum as the value rises. Feed it a value and the ends of its range, e.g. from Parameter Property feedbacks`,
			options: dialOptions('minimum', 'The value at the empty end of the arc', combineRgb(0, 204, 0)),
			elements: [dialGauge('minimum')],
		},
		[CompositeElementId.CentredDial]: {
			type: 'composite',
			name: 'Centred Dial',
			description: `A knob-style arc growing out from zero, clockwise towards ${DIAL_END_HOUR} o'clock above it and anticlockwise towards ${DIAL_START_HOUR} below, with a dot marking the position. Zero sits at 12 o'clock when the two ends match, and off to one side when they don't`,
			options: dialOptions('centred', 'The value at the anticlockwise end of the arc', combineRgb(255, 255, 0)),
			elements: [dialGauge('centred')],
		},
		[CompositeElementId.WidthDial]: {
			type: 'composite',
			name: 'Width Dial',
			description: `A knob-style arc growing both ways from 12 o'clock: a dot at the minimum, opening out until it runs the whole way from ${DIAL_START_HOUR} o'clock to ${DIAL_END_HOUR} at the maximum`,
			options: dialOptions('width', "The value drawn as a dot at 12 o'clock", combineRgb(182, 182, 182)),
			elements: [dialGauge('width')],
		},
	}

	self.setCompositeElementDefinitions(compositeElements)
}
