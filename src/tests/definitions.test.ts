import { describe, it, expect, vi } from 'vitest'
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type { CompanionMigrationAction, CompanionRecordedAction, JsonValue } from '@companion-module/base'
import { Model as EmberModel, type EmberClient } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import { ActionId, GetActionsList } from '../actions.js'
import type { EmberPlusConfig } from '../config.js'
import { GetFeedbacksList } from '../feedback.js'
import type EmberPlusInstance from '../index.js'
import { EmberPlusState } from '../state.js'
import {
	limitOptionsApi2,
	matrixOptionsMoved,
	numericOptionsApi2,
	numericPairsApi2,
	optionsRemovedAfterApi2,
	pathPairsApi2,
	renamedFeedbacksApi2,
	UpgradeScripts,
} from '../upgrades.js'
import { recordMatrixSetConnectionAction, recordParameterAction } from '../util.js'

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
	choices?: Array<{ id: JsonValue; label: string }>
	default?: JsonValue
}

interface Definition {
	options: Field[]
	optionsToMonitorForSubscribe?: string[]
	learn?: unknown
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

/**
 * Two configured matrices, loaded: 1.4, 1:N, with target 1 and sources 1 and 2, labelled; and Video.Router, N:N,
 * unlabelled, its targets and sources named by identifier
 */
function matrixState(): EmberPlusState {
	const state = new EmberPlusState()
	state.setMatrixPaths(['1.4', "Video's Router"])
	const audio = new EmberModel.MatrixImpl('audio')
	audio.targets = new Map([[1, {}]])
	audio.sources = new Map([
		[1, {}],
		[2, {}],
	])
	const info = state.matrices.get('1.4')!
	info.node = new EmberModel.NumberedTreeNodeImpl(4, audio)
	info.labels.targets.set(1, new Map([[0, ' Mon ']]))
	info.labels.sources.set(1, new Map([[0, 'Mic']]))
	const video = new EmberModel.MatrixImpl('video')
	video.matrixType = EmberModel.MatrixType.NToN
	video.targets = new Map([[3, { identifier: 'Out 3' }]])
	video.sources = new Map([[5, { identifier: 'Cam 5' }]])
	state.matrices.get("Video's Router")!.node = new EmberModel.NumberedTreeNodeImpl(5, video)
	return state
}

const all = definitions(matrixState())
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

	// The value is as displayed, the parameter's own formula or factor converting it, or with Device Units in the
	// device's units, sent as it is. An action upgraded with a Factor other than 1 has Device Units ticked
	it.each([ActionId.SetValueInt, ActionId.SetValueReal])('%s offers Device Units, unticked', (id) => {
		const deviceUnits = field(all.actions[id], 'deviceUnits')
		expect(deviceUnits).toMatchObject({ type: 'checkbox', default: false })
		expect(deviceUnits?.isVisibleExpression).toBeUndefined()
	})

	// The parameter's own factor or formula converts a displayed value; there is no Factor of the action's to set
	it.each([ActionId.SetValueInt, ActionId.SetValueReal])('%s has no Factor of its own', (id) => {
		expect(field(all.actions[id], 'factor')).toBeUndefined()
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
			it(`${kind} ${id}: each folded number is a number option, unless a later script moves it`, () => {
				const moved = matrixOptionsMoved[kind][id] ?? []
				for (const pair of fold?.pairs ?? []) {
					if (moved.includes(pair.value)) expect(field(all[kind][id], pair.value)?.type).not.toBe('number')
					else expect(field(all[kind][id], pair.value)).toMatchObject({ type: 'number' })
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
			it(`${kind} ${id}: ${keys?.join(', ')} are number options, unless a later script removes them`, () => {
				const removed = optionsRemovedAfterApi2[kind][id] ?? []
				for (const key of keys ?? []) {
					if (removed.includes(key)) expect(field(all[kind][id], key)).toBeUndefined()
					else expect(field(all[kind][id], key)).toMatchObject({ type: 'number' })
				}
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

describe('ramp actions', () => {
	/** A writeable parameter of each type, and a read-only Integer */
	function typedState(): EmberPlusState {
		const state = new EmberPlusState()
		const types = [ParameterType.Integer, ParameterType.Real, ParameterType.Enum, ParameterType.String]
		types.forEach((parameterType, i) =>
			state.updateParameterMap(`1.${i + 1}`, {
				number: i + 1,
				contents: { type: ElementType.Parameter, parameterType, access: ParameterAccess.ReadWrite, value: 0 },
			} as never),
		)
		state.updateParameterMap('1.9', {
			number: 9,
			contents: { type: ElementType.Parameter, parameterType: ParameterType.Integer, access: ParameterAccess.Read },
		} as never)
		return state
	}

	it.each([ActionId.RampValue, ActionId.StopRamp])('%s lists the writeable Integer and Real paths only', (id) => {
		const ids = field(definitions(typedState()).actions[id], 'path')?.choices?.map((choice) => choice.id)
		expect(ids).toEqual(['1.1', '1.2'])
	})

	it('Ramp Value has the fields of a relative Set Value, a duration from 0, and the easing curves', () => {
		const definition = all.actions[ActionId.RampValue]
		expect(definition.options.map((option) => option.id)).toEqual([
			'path',
			'value',
			'duration',
			'easing',
			'relative',
			'min',
			'max',
			'waitNote',
		])
		expect(field(definition, 'duration')).toMatchObject({ type: 'number', min: 0 })
		const easing = field(definition, 'easing')
		expect(easing).toMatchObject({ type: 'dropdown', default: 'linear' })
		expect(easing?.choices?.map((choice) => choice.id)).not.toContain('bounce-out')
		for (const id of ['min', 'max']) {
			expect(field(definition, id)).toMatchObject({ isVisibleExpression: '!!$(options:relative)' })
		}
		// The value can be a negative change
		expect(field(definition, 'value')?.min).toBeLessThan(0)
		expect(definition.learn).toBeDefined()
		expect(definition.optionsToMonitorForSubscribe).toEqual(['path'])
	})

	it('Ramp Value says how long a ramp the action waits for can take', () => {
		expect(field(all.actions[ActionId.RampValue], 'waitNote')).toMatchObject({
			type: 'static-text',
			value: expect.stringContaining('about 5 seconds'),
		})
	})

	it('Stop Ramp hides the path while it stops every ramp', () => {
		const definition = all.actions[ActionId.StopRamp]
		expect(field(definition, 'all')).toMatchObject({ type: 'checkbox', default: false })
		expect(field(definition, 'path')).toMatchObject({ isVisibleExpression: '!$(options:all)' })
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

/**
 * Whether a field shows, as Companion decides it (shared-lib/lib/IsVisible.ts): its expression, reading only fields
 * that can't be expressions, with the values given; an expression it can't evaluate shows the field
 */
function isVisible(definition: Definition, option: Field, values: Record<string, JsonValue>): boolean {
	if (!option.isVisibleExpression) return true
	const readable = new Set(definition.options.filter((o) => o.disableAutoExpression).map((o) => o.id))
	try {
		const value = ResolveExpression(ParseExpression(option.isVisibleExpression), {
			// This version of the engine names a variable `label:name`
			getVariableValue: (id: string) => {
				const [label, name] = id.split(':')
				if (label !== 'options' || !readable.has(name)) throw new Error(`${id} not allowed`)
				return values[name]
			},
			unknownVariableValue: undefined,
			parseVariables: null,
		})
		return !!value && value !== 'false' && value !== '0'
	} catch {
		return true
	}
}

const matrixItems = [
	['actions', ActionId.MatrixConnect],
	['actions', ActionId.MatrixDisconnect],
	['actions', ActionId.MatrixSetConnection],
	['actions', ActionId.SetSelectedSource],
	['actions', ActionId.SetSelectedTarget],
	['feedbacks', 'sourceBackgroundSelected'],
	['feedbacks', 'targetBackgroundSelected'],
	['feedbacks', 'matrix_property'],
] as const

describe('matrix fields', () => {
	it.each(matrixItems)('%s %s chooses the matrix from the configured ones, by path', (kind, id) => {
		expect(field(all[kind][id], 'matrix')).toMatchObject({
			type: 'dropdown',
			disableAutoExpression: true,
			choices: [
				{ id: '1.4', label: '1.4: audio' },
				{ id: "Video's Router", label: "Video's Router: video" },
			],
			default: '1.4',
		})
	})

	// Companion only reads a field that can't be an expression in isVisibleExpression; on any other it shows every field
	it.each(matrixItems)("%s %s shows only the chosen matrix's fields", (kind, id) => {
		const definition = all[kind][id]
		const signalField = (option: Field) => /^(target|source|sources)_/.test(option.id)
		const extra = kind === 'feedbacks' && id === 'matrix_property' ? [{ signal: 'target' }, { signal: 'source' }] : [{}]
		for (const values of extra) {
			for (const [matrix, key] of [
				['1.4', '1_4'],
				["Video's Router", 'Video__000027s__000020Router'],
			]) {
				const shown = definition.options
					.filter((option) => signalField(option) && isVisible(definition, option, { matrix, ...values }))
					.map((option) => option.id)
				expect(shown.length, `${matrix} ${JSON.stringify(values)}`).toBeGreaterThan(0)
				for (const shownId of shown) expect(shownId.endsWith(`_${key}`), shownId).toBe(true)
			}
		}
	})

	it("lists a matrix's signals by number and name, lowest first", () => {
		const definition = all.actions[ActionId.MatrixConnect]
		expect(field(definition, 'target_1_4')).toMatchObject({
			type: 'dropdown',
			choices: [{ id: 1, label: '1: Mon' }],
			default: 1,
		})
		expect(field(definition, 'sources_1_4')?.choices).toEqual([
			{ id: 1, label: '1: Mic' },
			{ id: 2, label: '2' },
		])
		expect(field(definition, 'target_Video__000027s__000020Router')?.choices).toEqual([{ id: 3, label: '3: Out 3' }])
	})

	// One id for both, so a source chosen before the matrix loads isn't lost when it turns out to be N:N
	it.each([ActionId.MatrixConnect, ActionId.MatrixDisconnect, ActionId.MatrixSetConnection])(
		'%s takes several sources of an N:N matrix, and one of any other, in the one field',
		(id) => {
			const definition = all.actions[id]
			expect(field(definition, 'sources_Video__000027s__000020Router')).toMatchObject({
				type: 'multidropdown',
				default: [],
			})
			expect(field(definition, 'sources_1_4')).toMatchObject({ type: 'dropdown' })
			expect(field(definition, 'source_Video__000027s__000020Router')).toBeUndefined()
			expect(field(definition, 'source_1_4')).toBeUndefined()
		},
	)

	it("offers None for Set Connection's one source, which disconnects the target", () => {
		expect(field(all.actions[ActionId.MatrixSetConnection], 'sources_1_4')?.choices?.[0]).toEqual({
			id: -1,
			label: 'None',
		})
		expect(field(all.actions[ActionId.MatrixConnect], 'sources_1_4')?.choices?.[0]).toEqual({ id: 1, label: '1: Mic' })
	})

	it.each([
		['1.4', [1]],
		['1.4', []],
		["Video's Router", [5]],
		["Video's Router", []],
	])(
		'a recorded Matrix Set Connection on %s, with sources %j, has only options the action has, shown together',
		(path, sources) => {
			const state = matrixState()
			const recorded: CompanionRecordedAction[] = []
			const self = { recordAction: vi.fn((a: CompanionRecordedAction) => recorded.push(a)) }
			recordMatrixSetConnectionAction(self as unknown as EmberPlusInstance, state.matrices.get(path)!, 3, sources)
			const definition = all.actions[ActionId.MatrixSetConnection]
			expect(recorded).toHaveLength(1)
			const values = recorded[0].options as Record<string, JsonValue>
			for (const key of Object.keys(values)) {
				expect(field(definition, key), key).toBeDefined()
				expect(isVisible(definition, field(definition, key)!, values), key).toBe(true)
			}
			// The multi-select of an N:N matrix takes a list, the dropdown of any other one of its choices (None for none)
			const sourcesField = Object.keys(values).find((key) => key.startsWith('sources_'))!
			const sourcesOption = field(definition, sourcesField)!
			if (sourcesOption.type === 'multidropdown') expect(values[sourcesField]).toEqual(sources)
			else expect(sourcesOption.choices?.map((c) => c.id)).toContain(values[sourcesField])
		},
	)

	it('lets Matrix Connect and Set Connection learn their sources, and not Disconnect', () => {
		expect(all.actions[ActionId.MatrixConnect]?.learn).toBeTypeOf('function')
		expect(all.actions[ActionId.MatrixSetConnection]?.learn).toBeTypeOf('function')
		expect(all.actions[ActionId.MatrixDisconnect]?.learn).toBeUndefined()
	})

	it.each([
		['actions', ActionId.SetSelectedSource],
		['feedbacks', 'sourceBackgroundSelected'],
		['feedbacks', 'matrix_property'],
	] as const)('%s %s takes one source, of an N:N matrix too', (kind, id) => {
		expect(field(all[kind][id], 'source_Video__000027s__000020Router')).toMatchObject({ type: 'dropdown' })
		expect(field(all[kind][id], 'sources_Video__000027s__000020Router')).toBeUndefined()
	})

	it("shows Matrix Property's properties of a target or a source, as chosen", () => {
		const definition = all.feedbacks['matrix_property']
		const shown = (signal: string) =>
			['targetProperty', 'sourceProperty'].filter((id) => isVisible(definition, field(definition, id)!, { signal }))
		expect(shown('target')).toEqual(['targetProperty'])
		expect(shown('source')).toEqual(['sourceProperty'])
		expect(field(definition, 'targetProperty')?.choices?.map((c) => c.id)).toEqual(
			expect.arrayContaining(['connections', 'disposition']),
		)
	})

	// A matrix not yet loaded (offline) keeps its fields, with nothing to list
	it('keeps the fields of a matrix not yet loaded', () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['1.4'])
		const definition = definitions(state).actions[ActionId.MatrixConnect]
		expect(field(definition, 'target_1_4')).toMatchObject({ type: 'dropdown', choices: [], default: 0 })
		expect(field(definition, 'sources_1_4')).toMatchObject({ type: 'dropdown', choices: [] })
	})

	// Counted as 1:N until it loads; once it loads as N:N, the field it was saved under is the multi-select
	it("keeps the id of a connection action's sources field when the matrix loads as N:N", () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['1.4'])
		const before = field(definitions(state).actions[ActionId.MatrixSetConnection], 'sources_1_4')
		const matrix = new EmberModel.MatrixImpl('router')
		matrix.matrixType = EmberModel.MatrixType.NToN
		state.matrices.get('1.4')!.node = new EmberModel.NumberedTreeNodeImpl(4, matrix)
		const after = field(definitions(state).actions[ActionId.MatrixSetConnection], 'sources_1_4')
		expect([before?.type, after?.type]).toEqual(['dropdown', 'multidropdown'])
	})
})

describe('matrix actions and feedbacks', () => {
	const matrixActions = [
		ActionId.MatrixConnect,
		ActionId.MatrixDisconnect,
		ActionId.MatrixSetConnection,
		ActionId.Take,
		ActionId.Clear,
		ActionId.SetSelectedSource,
		ActionId.SetSelectedTarget,
	]
	const matrixFeedbacks = ['take', 'clear', 'sourceBackgroundSelected', 'targetBackgroundSelected', 'matrix_property']

	it('are not offered without a matrix: none configured, or none the provider has', () => {
		const { actions, feedbacks } = definitions(new EmberPlusState())
		for (const id of matrixActions) expect(actions[id], id).toBeUndefined()
		for (const id of matrixFeedbacks) expect(feedbacks[id], id).toBeUndefined()
		expect(actions[ActionId.SetValueInt]).toBeDefined()
		expect(feedbacks['parameter_property']).toBeDefined()
	})

	// Configured, and not yet shown not to be a matrix
	it('are offered for a configured matrix not yet loaded', () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['1.4'])
		const { actions, feedbacks } = definitions(state)
		for (const id of matrixActions) expect(actions[id], id).toBeDefined()
		for (const id of matrixFeedbacks) expect(feedbacks[id], id).toBeDefined()
	})
})

describe('the matrices upgrade matches the definitions', () => {
	/** Run the matrices script alone on an action */
	function upgraded(item: CompanionMigrationAction, matricesString: string): CompanionMigrationAction {
		const script = UpgradeScripts.find((s) => s.name === 'matricesByPath')!
		const config = { matricesString } as EmberPlusConfig
		script({ currentConfig: config }, { config, secrets: null, actions: [item], feedbacks: [] })
		return item
	}
	const plain = (value: JsonValue) => ({ isExpression: false as const, value })

	it.each([ActionId.MatrixConnect, ActionId.MatrixDisconnect, ActionId.MatrixSetConnection])(
		'%s: each option written is a field, for a 1:N matrix or an N:N one',
		(actionId) => {
			const action = upgraded(
				{
					id: 'a',
					controlId: 'c',
					actionId,
					options: { path: plain("Video's Router"), target: plain(3), sources: plain('5') },
				},
				"1.4, Video's Router",
			)
			const nToN = definitions(matrixState()).actions[actionId]
			const oneToN = matrixState()
			oneToN.matrices.get("Video's Router")!.node!.contents.matrixType = EmberModel.MatrixType.OneToN
			const other = definitions(oneToN).actions[actionId]
			for (const key of Object.keys(action.options)) {
				expect(field(nToN, key) ?? field(other, key), key).toBeDefined()
			}
		},
	)

	it.each([
		[ActionId.SetSelectedSource, 'source'],
		[ActionId.SetSelectedTarget, 'target'],
	])('%s: each option written is a field', (actionId, kind) => {
		const action = upgraded(
			{ id: 'a', controlId: 'c', actionId, options: { matrix: plain(1), [kind]: plain(3) } },
			"1.4, Video's Router",
		)
		const definition = all.actions[actionId]
		for (const key of Object.keys(action.options)) expect(field(definition, key), key).toBeDefined()
	})
})
