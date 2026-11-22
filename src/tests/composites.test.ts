import { describe, it, expect, vi, type Mock } from 'vitest'
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type { ButtonGraphicsGaugeElement, CompanionGraphicsCompositeElementDefinitions } from '@companion-module/base'
import {
	CompositeElementId,
	METER_DEFAULT_MAX,
	METER_DEFAULT_MIN,
	METER_STOPS,
	SPECTRUM_STOPS,
	UpdateCompositeElements,
	type CompositeElementSchema,
} from '../composites.js'
import type EmberPlusInstance from '../index.js'

type Definitions = CompanionGraphicsCompositeElementDefinitions<CompositeElementSchema>
/** A composite as defined. Base also allows `false` or `undefined`, for one the module does not offer. */
type Definition<K extends CompositeElementId> = Exclude<Definitions[K], false | undefined>

function definitionOf<K extends CompositeElementId>(definitions: Definitions, id: K): Definition<K> {
	const definition = definitions[id]
	if (!definition) throw new Error(`No ${id} element was defined`)
	return definition as Definition<K>
}

function defineElements(): { definitions: Definitions; meter: Definition<CompositeElementId.Meter> } {
	const setCompositeElementDefinitions: Mock<(definitions: Definitions) => void> = vi.fn()
	UpdateCompositeElements({ setCompositeElementDefinitions } as unknown as EmberPlusInstance)
	const definitions = setCompositeElementDefinitions.mock.lastCall?.[0]
	if (!definitions) throw new Error('No composite elements were defined')
	return { definitions, meter: definitionOf(definitions, CompositeElementId.Meter) }
}

/** The gauge one of the composites is made of. */
function gaugeOf(id: CompositeElementId): ButtonGraphicsGaugeElement {
	const { definitions } = defineElements()
	const gauge = definitionOf(definitions, id).elements.find((element) => element.type === 'gauge')
	if (!gauge) throw new Error(`${id} has no gauge`)
	return gauge
}

const meterGauge = (): ButtonGraphicsGaugeElement => gaugeOf(CompositeElementId.Meter)

/**
 * Where a point on a ring gauge's arc sits on a clock face, by Companion's maths
 * (`LayeredRenderer.ts:596-620`): angles are degrees clockwise from 12 o'clock, and the arc runs
 * clockwise from `startAngle` for `sweep` degrees.
 */
function clockPosition(degrees: number): number {
	const hour = (degrees / 30) % 12
	return ((hour % 12) + 12) % 12 || 12
}

/** The arc's clockwise span, the way the renderer derives it; a span of 0 would mean a full circle. */
function sweepDegrees(start: number, end: number): number {
	return (((end - start) % 360) + 360) % 360 || 360
}

describe('composite elements', () => {
	it('offers a meter taking a level and the two ends of the range it draws', () => {
		const { meter } = defineElements()

		expect(meter.options.map((option) => option.id)).toEqual([
			'level',
			'min',
			'max',
			'position',
			'padding',
			'scheme',
			'color',
		])
		// A parameter reads in whatever unit the device gives it, so nothing here is limited to a dB range
		for (const id of ['level', 'min', 'max']) {
			const option = meter.options.find((o) => o.id === id)
			expect(option, id).toMatchObject({ type: 'number', min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER })
		}
		expect(meter.options.find((o) => o.id === 'position')).toMatchObject({ default: 'bottom' })
	})

	it('draws the bar between the given ends, from the given level', () => {
		const gauge = meterGauge()

		expect(gauge.min).toEqual({ isExpression: true, value: '$(options:min)' })
		expect(gauge.max).toEqual({ isExpression: true, value: '$(options:max)' })
		expect(gauge.value).toEqual({ isExpression: true, value: '$(options:level)' })
	})

	it('draws the meter in one colour instead of the metering scale when asked', () => {
		const { meter } = defineElements()
		const gauge = meterGauge()

		expect(meter.options.find((o) => o.id === 'scheme')).toMatchObject({ type: 'dropdown', default: 'meter' })
		expect(meter.options.find((o) => o.id === 'color')).toMatchObject({ type: 'colorpicker', default: 0x00cc00 })
		// Only the metering scale blends between colours
		expect(gauge.multiColour).toEqual({ isExpression: true, value: "$(options:scheme) == 'meter'" })
		// Every stop falls back to the chosen colour, so the bar is flat whichever one the reading is in
		const stops = gauge.stops as { color: { value: string } }[]
		expect(stops).toHaveLength(5)
		for (const [index, stop] of stops.entries()) {
			expect(stop.color.value, `stop ${index}`).toBe(
				`$(options:scheme) == 'meter' ? ${METER_STOPS[index]?.color} : $(options:color)`,
			)
		}
	})

	it('spaces its colour stops across the range, rather than at fixed levels', () => {
		const gauge = meterGauge()

		expect((gauge.stops as { value: unknown }[]).map((stop) => stop.value)).toEqual([
			// The bottom of the bar, wherever that is
			{ isExpression: true, value: '$(options:min)' },
			{ isExpression: true, value: '$(options:min) + ($(options:max) - $(options:min)) * 0.3333333333333333' },
			{ isExpression: true, value: '$(options:min) + ($(options:max) - $(options:min)) * 0.6666666666666666' },
			{ isExpression: true, value: '$(options:min) + ($(options:max) - $(options:min)) * 0.8' },
			{ isExpression: true, value: '$(options:min) + ($(options:max) - $(options:min)) * 0.9' },
		])
		// Every stop blends into the next, so the bar is a gradient rather than five bands
		expect((gauge.stops as { gradient: unknown }[]).every((stop) => stop.gradient === true)).toBe(true)
	})

	it("draws the dial as an arc from 8 o'clock round through 12 to 4, leaving the bottom undrawn", () => {
		const gauge = gaugeOf(CompositeElementId.Dial)
		const start = gauge.startAngle as number
		const end = gauge.endAngle as number

		expect(gauge.orientation).toBe('ring')
		expect(clockPosition(start)).toBe(8)
		expect(clockPosition(end)).toBe(4)
		// Clockwise from 8 up through 12 and down to 4, so the bottom 120 degrees is never drawn
		expect(sweepDegrees(start, end)).toBe(240)
		// Halfway along the arc is straight up
		expect(clockPosition(start + sweepDegrees(start, end) / 2)).toBe(12)
	})

	it('fills the dial from the given value and range, in one colour defaulting to green', () => {
		const { definitions } = defineElements()
		const dial = definitions[CompositeElementId.Dial]
		if (!dial) throw new Error('No dial element was defined')
		const gauge = gaugeOf(CompositeElementId.Dial)

		expect(dial.options.map((option) => option.id)).toEqual(['level', 'min', 'max', 'color', 'scheme'])
		expect(dial.options.find((o) => o.id === 'color')).toMatchObject({ type: 'colorpicker', default: 0x00cc00 })
		expect(dial.options.find((o) => o.id === 'scheme')).toMatchObject({ type: 'dropdown', default: 'single' })
		expect(gauge.value).toEqual({ isExpression: true, value: '$(options:level)' })
		expect(gauge.min).toEqual({ isExpression: true, value: '$(options:min)' })
		expect(gauge.max).toEqual({ isExpression: true, value: '$(options:max)' })
		// Blended only on a spectrum; on a single colour every stop resolves to it, so the arc stays flat
		expect(gauge.multiColour).toEqual({ isExpression: true, value: "$(options:scheme) == 'spectrum'" })
	})

	// Newton's seven, each blending into the next, spaced across whatever range the dial is given
	it('runs the value dial through the spectrum when asked, red at the bottom and violet at the top', () => {
		const gauge = gaugeOf(CompositeElementId.Dial)
		const stops = gauge.stops as { value: { value: string }; color: { value: string }; gradient: boolean }[]

		expect(stops).toHaveLength(7)
		expect(SPECTRUM_STOPS.map((stop) => stop.color)).toEqual([
			0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3,
		])
		expect(stops[0]?.value.value).toBe('$(options:min)')
		expect(stops[6]?.value.value).toBe('$(options:min) + ($(options:max) - $(options:min)) * 1')
		for (const [index, stop] of stops.entries()) {
			expect(stop.color.value, `stop ${index}`).toBe(
				`$(options:scheme) == 'spectrum' ? ${SPECTRUM_STOPS[index]?.color} : $(options:color)`,
			)
			expect(stop.gradient, `stop ${index}`).toBe(true)
		}
	})

	it('grows the centred dial out from zero, held inside the range, in yellow by default', () => {
		const { definitions } = defineElements()
		const centred = definitions[CompositeElementId.CentredDial]
		if (!centred) throw new Error('No centred dial element was defined')
		const gauge = gaugeOf(CompositeElementId.CentredDial)

		expect(centred.options.find((o) => o.id === 'color')).toMatchObject({ type: 'colorpicker', default: 0xffff00 })
		// Zero clamped into the range: 12 o'clock when the ends match, offset when they don't, and on
		// whichever end is nearer when the range never reaches zero
		expect(gauge.origin).toEqual({ isExpression: true, value: 'min(max(0, $(options:min)), $(options:max))' })
		// Not symmetric: the fill runs from the origin to the value, so it grows either way from zero
		expect(gauge.symmetric).toBeUndefined()
	})

	it('opens the width dial both ways from the middle, a dot at the minimum and the whole arc at the maximum', () => {
		const gauge = gaugeOf(CompositeElementId.WidthDial)

		// Symmetric makes the fill a band of the value's own length, centred on the origin
		expect(gauge.symmetric).toBe(true)
		expect(gauge.origin).toEqual({ isExpression: true, value: '($(options:min) + $(options:max)) / 2' })
	})

	// The renderer draws the marker at the value whether or not there is a fill, and at the origin there is none
	it('marks the position on both growing dials with a bead, so a value at the origin still shows a dot', () => {
		for (const id of [CompositeElementId.CentredDial, CompositeElementId.WidthDial]) {
			const gauge = gaugeOf(id)

			expect(gauge.markerEnabled, id).toBe(true)
			// A percentage of the ring's thickness; Companion's default of 15 would round to a hairline
			expect(gauge.markerWidth, id).toBe(100)
		}
		// The width dial has one colour; the centred dial's dot takes the colour of the end it heads
		// for, and the zero colour when it sits on zero with no fill either side of it
		expect(gaugeOf(CompositeElementId.WidthDial).markerColor).toEqual({
			isExpression: true,
			value: '$(options:color)',
		})
		expect(gaugeOf(CompositeElementId.CentredDial).markerColor).toEqual({
			isExpression: true,
			value:
				'$(options:level) < min(max(0, $(options:min)), $(options:max)) ? $(options:colorBelow) : ($(options:level) > min(max(0, $(options:min)), $(options:max)) ? $(options:color) : $(options:colorZero))',
		})
	})

	// The renderer blends between consecutive stops when multiColour is on, so a stop at each end and
	// one at zero shades the arc away from zero in both directions
	it('gives the centred dial a colour at zero blending out to one at each end', () => {
		const { definitions } = defineElements()
		const centred = definitions[CompositeElementId.CentredDial]
		if (!centred) throw new Error('No centred dial element was defined')
		const gauge = gaugeOf(CompositeElementId.CentredDial)

		expect(centred.options.map((option) => option.id)).toEqual([
			'level',
			'min',
			'max',
			'color',
			'colorZero',
			'colorBelow',
		])
		// All three default alike, so a dial is one colour throughout until told otherwise
		const colours = centred.options.filter((option) => option.type === 'colorpicker')
		expect(colours.map((option) => option.default)).toEqual([0xffff00, 0xffff00, 0xffff00])
		expect(gauge.multiColour).toBe(true)
		expect(gauge.stops).toEqual([
			{
				value: { isExpression: true, value: '$(options:min)' },
				color: { isExpression: true, value: '$(options:colorBelow)' },
				gradient: true,
			},
			{
				value: { isExpression: true, value: 'min(max(0, $(options:min)), $(options:max))' },
				color: { isExpression: true, value: '$(options:colorZero)' },
				gradient: true,
			},
			// The last stop has nothing beyond it to blend into
			{
				value: { isExpression: true, value: '$(options:max)' },
				color: { isExpression: true, value: '$(options:color)' },
				gradient: false,
			},
		])
	})

	// It grows from a point rather than running a scale along the arc, so a spectrum would say nothing
	it('leaves the width dial with a single colour', () => {
		const { definitions } = defineElements()

		expect(definitionOf(definitions, CompositeElementId.WidthDial).options.map((option) => option.id)).toEqual([
			'level',
			'min',
			'max',
			'color',
		])
		expect((gaugeOf(CompositeElementId.WidthDial).stops as unknown[]).length).toBe(1)
	})

	it('leaves the plain value dial growing from the minimum, with no marker', () => {
		const gauge = gaugeOf(CompositeElementId.Dial)

		// No origin means the renderer's default, which is to grow from the minimum
		expect(gauge.origin).toBeUndefined()
		expect(gauge.markerEnabled).toBeUndefined()
	})

	it('draws every dial with the same ring, so only where the arc grows from differs', () => {
		const dial = gaugeOf(CompositeElementId.Dial)

		for (const id of [CompositeElementId.CentredDial, CompositeElementId.WidthDial]) {
			const other = gaugeOf(id)
			for (const key of ['x', 'y', 'width', 'height', 'orientation', 'startAngle', 'endAngle', 'ringWidth'] as const) {
				expect(other[key], `${id} ${key}`).toEqual(dial[key])
			}
		}
	})

	// The renderer centres a ring and takes its radius from the shorter side, so a centred square keeps it round
	it('insets the dial from every edge, so it scales with the button without touching its sides', () => {
		const { x, y, width, height } = gaugeOf(CompositeElementId.Dial)
		// Fixed numbers rather than expressions, so the sums below are what the renderer is given
		if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
			throw new Error('The dial is not placed by fixed numbers')
		}

		// Square, so the ring is a circle rather than sitting inside an ellipse
		expect(width).toBe(height)
		// Centred, so the gap is the same at 12, 3, 6 and 9 o'clock
		expect(x).toBe(y)
		expect(x).toBeGreaterThan(0)
		expect(x + width).toBe(100 - x)
	})

	// So a meter left on the defaults matches one from companion-module-turtleav-mineola, whose stops are fixed there
	it("puts the stops at mineola's dB levels when left on the default range", () => {
		const levels = METER_STOPS.map((stop) => METER_DEFAULT_MIN + (METER_DEFAULT_MAX - METER_DEFAULT_MIN) * stop.at)

		expect(levels).toHaveLength(5)
		for (const [index, expected] of [-60, -40, -20, -12, -6].entries()) {
			expect(levels[index], `stop ${index}`).toBeCloseTo(expected, 10)
		}
	})
})

/**
 * An element property as Companion resolves it: an expression evaluated by Companion's own engine, with the options
 * given (shared-lib/lib/Expressions.ts), or a fixed value as it is
 */
function resolve(property: unknown, options: Record<string, unknown>): unknown {
	if (typeof property !== 'object' || property === null || !('isExpression' in property)) return property
	const { isExpression, value } = property as { isExpression: boolean; value: unknown }
	if (!isExpression) return value
	return ResolveExpression(ParseExpression(String(value)), {
		// This version of the engine names a variable `label:name`
		getVariableValue: (id: string) => options[id.replace(/^options:/, '')] as never,
		unknownVariableValue: undefined,
		parseVariables: null,
		stringConcatenation: false,
		processTemplateEscapes: false,
	})
}

describe("composite elements, as Companion's expression engine draws them", () => {
	it.each([
		['bottom', { x: 6, y: 90, width: 88, height: 8, orientation: 'horizontal' }],
		['top', { x: 6, y: 2, width: 88, height: 8, orientation: 'horizontal' }],
		['left', { x: 2, y: 6, width: 8, height: 88, orientation: 'vertical' }],
		['right', { x: 90, y: 6, width: 8, height: 88, orientation: 'vertical' }],
	])('places a meter at the %s of the button', (position, expected) => {
		const gauge = meterGauge()
		const options = { position, padding: 2 }
		const placed = Object.fromEntries(
			(['x', 'y', 'width', 'height', 'orientation'] as const).map((key) => [key, resolve(gauge[key], options)]),
		)
		expect(placed).toEqual(expected)
	})

	it("colours a meter on a meter's dB range by the metering scale, or in one colour", () => {
		const stops = meterGauge().stops as { value: unknown; color: unknown }[]
		const metering = { min: -60, max: 0, scheme: 'meter', color: 0x123456 }
		const levels = stops.map((stop) => resolve(stop.value, metering) as number)
		for (const [index, expected] of [-60, -40, -20, -12, -6].entries()) expect(levels[index]).toBeCloseTo(expected, 10)
		expect(stops.map((stop) => resolve(stop.color, metering))).toEqual(METER_STOPS.map((stop) => stop.color))
		expect(stops.map((stop) => resolve(stop.color, { ...metering, scheme: 'custom' }))).toEqual(Array(5).fill(0x123456))
	})

	it.each([
		['either side of zero', -10, 10, 0],
		['wholly above zero', 10, 20, 10],
		['wholly below zero', -20, -10, -10],
	])('grows a centred dial on a range %s from zero held inside it', (_name, min, max, origin) => {
		expect(resolve(gaugeOf(CompositeElementId.CentredDial).origin, { min, max })).toBe(origin)
	})

	it.each([
		[-5, 0x0000ff],
		[0, 0x00ff00],
		[5, 0xff0000],
	])('marks a centred dial at %i in the colour of the side it is on', (level, colour) => {
		const options = { min: -10, max: 10, level, color: 0xff0000, colorZero: 0x00ff00, colorBelow: 0x0000ff }
		expect(resolve(gaugeOf(CompositeElementId.CentredDial).markerColor, options)).toBe(colour)
	})

	it('opens a width dial from the middle of its range', () => {
		expect(resolve(gaugeOf(CompositeElementId.WidthDial).origin, { min: 0, max: 200 })).toBe(100)
	})
})
