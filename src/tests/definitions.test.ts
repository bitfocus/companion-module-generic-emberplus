import { describe, it, expect, vi } from 'vitest'
import type { CompanionRecordedAction } from '@companion-module/base'
import { Model as EmberModel, type EmberClient } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, GetActionsList } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { GetFeedbacksList } from '../feedback.js'
import type EmberPlusInstance from '../index.js'
import { EmberPlusState } from '../state.js'
import {
	limitOptionsApi2,
	numericOptionsApi2,
	numericPairsApi2,
	pathPairsApi2,
	renamedFeedbacksApi2,
} from '../upgrades.js'
import { recordParameterAction } from '../util.js'

const { ElementType, ParameterType, ParameterAccess } = EmberModel

/** An option field, as far as these checks read one */
interface Field {
	id: string
	type: string
	min?: number
	max?: number
	allowCustom?: boolean
	disableAutoExpression?: boolean
	isVisibleExpression?: string
}

interface Definition {
	options: Field[]
	optionsToMonitorForSubscribe?: string[]
}

const config: EmberPlusConfig = {
	host: '10.0.0.1',
	port: 9000,
	factor: true,
	verbose: false,
	variables: ['parameterValues'],
}

function definitions(state = new EmberPlusState()) {
	const self = {} as EmberPlusInstance
	const client = {} as EmberClient
	const queue = {} as PQueue
	const actions = GetActionsList(self, client, config, state, queue) as unknown as Record<string, Definition>
	const feedbacks = GetFeedbacksList(self, client, config, state) as unknown as Record<string, Definition>
	return { actions, feedbacks }
}

function field(definition: Definition | undefined, id: string): Field | undefined {
	return definition?.options.find((option) => option.id === id)
}

const all = definitions()
const everything = [
	...Object.entries(all.actions).map(([id, d]) => [`action ${id}`, d] as const),
	...Object.entries(all.feedbacks).map(([id, d]) => [`feedback ${id}`, d] as const),
]

describe('action and feedback definitions', () => {
	// Companion: "you can only reference fields which are set to disableAutoExpression" in isVisibleExpression
	it.each(everything)('%s shows and hides fields only on fields that cannot be expressions', (_name, definition) => {
		for (const option of definition.options) {
			for (const [, id] of option.isVisibleExpression?.matchAll(/\$\(options:(\w+)\)/g) ?? []) {
				expect(field(definition, id), `${option.id} reads ${id}`).toMatchObject({ disableAutoExpression: true })
			}
		}
	})

	it.each(everything)('%s has none of the option ids API 2 folded away', (_name, definition) => {
		const ids = definition.options.map((option) => option.id)
		for (const gone of [
			'pathVar',
			'usePathVar',
			'useVar',
			'valueVar',
			'targetVar',
			'matrixVar',
			'sourceVar',
			'variable',
		]) {
			expect(ids).not.toContain(gone)
		}
	})

	// A path the module has not cached yet must be accepted: the callbacks register it with the provider on first
	// use, which is what adds it to the dropdowns. A dropdown without allowCustom would only offer cached paths
	it.each(everything.filter(([, d]) => field(d, 'path') !== undefined))(
		'%s accepts a path not yet registered',
		(_name, definition) => {
			const path = field(definition, 'path')
			if (path?.type === 'dropdown') expect(path.allowCustom).toBe(true)
			else expect(path?.type).toBe('textinput')
		},
	)

	// The value is as displayed, the parameter's own formula or factor converting it. Only an action upgraded with a
	// Factor other than 1 has Device Units ticked, and shows it and its Factor
	it('Set Value Integer shows Device Units and its Factor only while Device Units is ticked', () => {
		const definition = all.actions[ActionId.SetValueInt]
		for (const id of ['deviceUnits', 'factor']) {
			expect(field(definition, id)).toMatchObject({ isVisibleExpression: '!!$(options:deviceUnits)' })
		}
		expect(field(definition, 'deviceUnits')).toMatchObject({ type: 'checkbox', default: false })
	})

	it.each(Object.entries(all.actions))('action %s monitors only options it has', (_id, definition) => {
		for (const id of definition.optionsToMonitorForSubscribe ?? []) {
			expect(field(definition, id), id).toBeDefined()
		}
	})
})

// The upgrade's lists are frozen history, so they can drift from the definitions as the module changes.
// These checks catch a fold that writes into an option the definition no longer has, or has as another type
describe('the API 2 upgrade matches the definitions', () => {
	for (const [kind, lists] of [
		['actions', numericPairsApi2.actions],
		['feedbacks', numericPairsApi2.feedbacks],
	] as const) {
		for (const [id, fold] of Object.entries(lists)) {
			it(`${kind} ${id}: each folded number is a number option`, () => {
				for (const pair of fold?.pairs ?? []) {
					expect(field(all[kind][id], pair.value)).toMatchObject({ type: 'number' })
				}
			})
		}
	}

	for (const [kind, ids] of [
		['actions', pathPairsApi2.actions],
		['feedbacks', pathPairsApi2.feedbacks],
	] as const) {
		for (const id of ids) {
			it(`${kind} ${id}: the folded path is a dropdown that takes a typed-in path`, () => {
				// A feedback renamed in 3.0 folds under its old id
				const current = kind === 'feedbacks' ? (renamedFeedbacksApi2[id] ?? id) : id
				expect(field(all[kind][current], 'path')).toMatchObject({ type: 'dropdown', allowCustom: true })
			})
		}
	}

	for (const [kind, lists] of [
		['actions', numericOptionsApi2.actions],
		['feedbacks', numericOptionsApi2.feedbacks],
	] as const) {
		for (const [id, keys] of Object.entries(lists)) {
			it(`${kind} ${id}: ${keys?.join(', ')} are number options`, () => {
				for (const key of keys ?? []) expect(field(all[kind][id], key)).toMatchObject({ type: 'number' })
			})
		}
	}

	for (const [id, range] of Object.entries(limitOptionsApi2)) {
		it(`actions ${id}: the limits are number options over the range the upgrade holds them to`, () => {
			for (const key of ['min', 'max']) {
				expect(field(all.actions[id], key)).toMatchObject({ type: 'number', min: range?.min, max: range?.max })
			}
		})
	}

	for (const [old, current] of Object.entries(renamedFeedbacksApi2)) {
		it(`feedbacks ${old}: renamed to ${current}, which exists, and the old id doesn't`, () => {
			expect(all.feedbacks[current ?? '']).toBeDefined()
			expect(all.feedbacks[old]).toBeUndefined()
		})
	}

	it.each(['parameter', 'string', 'enum', 'boolean'])(
		'feedbacks %s is marked deprecated, to be removed in a future release',
		(id) => {
			const definition = all.feedbacks[id] as unknown as { name: string; description: string }
			expect(definition.name).toMatch(/\(Deprecated\)$/)
			expect(definition.description).toContain('will be removed in a future release')
		},
	)

	it('Parameter Property has the properties the upgrade picks from Return ENUM', () => {
		const property = field(all.feedbacks['parameter_property'], 'property') as Field & {
			choices: Array<{ id: string }>
		}
		expect(property.choices.map((c) => c.id)).toEqual(expect.arrayContaining(['value', 'enumeration']))
	})

	it('the boolean value is a checkbox', () => {
		expect(field(all.actions[ActionId.SetValueBoolean], 'value')).toMatchObject({ type: 'checkbox' })
	})
})

describe('recorded actions', () => {
	const types = [
		[ActionId.SetValueBoolean, ParameterType.Boolean, true],
		[ActionId.SetValueInt, ParameterType.Integer, 5],
		[ActionId.SetValueReal, ParameterType.Real, 1.5],
		[ActionId.SetValueEnum, ParameterType.Enum, 1],
		[ActionId.SetValueString, ParameterType.String, 'text'],
	] as const

	it.each(types)('%s records only options the action has', (actionId, parameterType, value) => {
		const state = new EmberPlusState()
		state.updateParameterMap('1.2', {
			number: 2,
			contents: {
				type: ElementType.Parameter,
				parameterType,
				access: ParameterAccess.ReadWrite,
				value,
				minimum: 0,
				maximum: 10,
				factor: 2,
				enumeration: 'Off\nOn',
			},
		} as never)
		const recorded: CompanionRecordedAction[] = []
		const self = { recordAction: vi.fn((a: CompanionRecordedAction) => recorded.push(a)) }
		recordParameterAction('1.2', actionId, value, self as unknown as EmberPlusInstance, state)

		const definition = definitions(state).actions[actionId]
		expect(recorded).toHaveLength(1)
		for (const key of Object.keys(recorded[0].options)) {
			expect(field(definition, key), key).toBeDefined()
		}
	})
})

// Glow gives a matrix's targets as Integer32, and its sources as path numbers the library holds to 2^31 - 1
describe('matrix targets and sources', () => {
	const signalFields = everything.flatMap(([name, definition]) =>
		definition.options
			.filter((option) => (option.id === 'target' || option.id === 'source') && option.type === 'number')
			.map((option) => [`${name} ${option.id}`, option] as const),
	)

	it('are on every matrix and selection action and feedback', () => {
		expect(signalFields.length).toBe(7)
	})

	it.each(signalFields)('%s is held to the range Ember+ allows', (_name, option) => {
		expect(option).toMatchObject({ min: 0, max: 2 ** 31 - 1 })
	})
})
