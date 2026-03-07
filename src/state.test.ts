import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmberPlusState } from './state.js'
import { ElementType } from 'emberplus-connection/dist/model'

vi.mock('emberplus-connection/dist/model', () => ({
	ElementType: {
		Parameter: 'parameter',
		Node: 'node',
	},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Record<string, any> = {}) {
	return {
		contents: {
			type: ElementType.Parameter,
			identifier: 'gain',
			value: 0,
			...overrides,
		},
	} as any
}

// ---------------------------------------------------------------------------
// constructor / initial state
// ---------------------------------------------------------------------------

describe('EmberPlusState constructor', () => {
	it('initialises selected with -1 for all fields', () => {
		const state = new EmberPlusState()
		expect(state.selected).toEqual({ source: -1, target: -1, matrix: -1 })
	})

	it('initialises empty parameters map', () => {
		expect(new EmberPlusState().parameters.size).toBe(0)
	})

	it('initialises empty monitoredParameters set', () => {
		expect(new EmberPlusState().monitoredParameters.size).toBe(0)
	})

	it('initialises empty matrices array', () => {
		expect(new EmberPlusState().matrices.length).toBe(0)
	})

	it('initialises empty emberElement map', () => {
		expect(new EmberPlusState().emberElement.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// addIdToPathMap / getFeedbacksByPath
// ---------------------------------------------------------------------------

describe('addIdToPathMap', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
	})

	it('registers a feedback id against a path', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		expect(state.getFeedbacksByPath('0.1.2').has('fb1')).toBe(true)
	})

	it('multiple ids can be registered against the same path', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.addIdToPathMap('fb2', '0.1.2')
		expect(state.getFeedbacksByPath('0.1.2').size).toBe(2)
	})

	it('adding same id twice does not create duplicates', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.addIdToPathMap('fb1', '0.1.2')
		expect(state.getFeedbacksByPath('0.1.2').size).toBe(1)
	})

	it('does not add to byPath when path is empty string', () => {
		state.addIdToPathMap('fb1', '')
		expect(state.getFeedbacksByPath('').size).toBe(0)
	})

	it('moves id to new path when path changes', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.addIdToPathMap('fb1', '0.1.3')
		expect(state.getFeedbacksByPath('0.1.2').has('fb1')).toBe(false)
		expect(state.getFeedbacksByPath('0.1.3').has('fb1')).toBe(true)
	})

	it('cleans up empty sets after path change', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.addIdToPathMap('fb1', '0.1.3')
		// byPath entry for old path should have been removed
		expect(state.getFeedbacksByPath('0.1.2').size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// getFeedbacksByPath
// ---------------------------------------------------------------------------

describe('getFeedbacksByPath', () => {
	it('returns an empty set for unknown paths', () => {
		const state = new EmberPlusState()
		const result = state.getFeedbacksByPath('unknown')
		expect(result).toBeInstanceOf(Set)
		expect(result.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// removeFeedbackId
// ---------------------------------------------------------------------------

describe('removeFeedbackId', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
	})

	it('removes id from byPath', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.removeFeedbackId('fb1')
		expect(state.getFeedbacksByPath('0.1.2').has('fb1')).toBe(false)
	})

	it('cleans up empty byPath entry after removal', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.removeFeedbackId('fb1')
		expect(state.getFeedbacksByPath('0.1.2').size).toBe(0)
	})

	it('does not remove other ids registered on the same path', () => {
		state.addIdToPathMap('fb1', '0.1.2')
		state.addIdToPathMap('fb2', '0.1.2')
		state.removeFeedbackId('fb1')
		expect(state.getFeedbacksByPath('0.1.2').has('fb2')).toBe(true)
	})

	it('does nothing for an unknown id', () => {
		state.removeFeedbackId('nonexistent')
	})
})

// ---------------------------------------------------------------------------
// updateParameterMap
// ---------------------------------------------------------------------------

describe('updateParameterMap', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
	})

	it('stores a new parameter', () => {
		state.updateParameterMap('0.1', makeNode({ identifier: 'level' }))
		expect(state.parameters.has('0.1')).toBe(true)
	})

	it('stores the ember element', () => {
		const node = makeNode()
		state.updateParameterMap('0.1', node)
		expect(state.emberElement.get('0.1')).toBe(node)
	})

	it('merges new fields into existing parameter', () => {
		state.updateParameterMap('0.1', makeNode({ identifier: 'level', value: 5 }))
		state.updateParameterMap('0.1', { contents: { type: ElementType.Parameter, value: 10 } } as any)
		expect(state.parameters.get('0.1')?.identifier).toBe('level')
		expect(state.parameters.get('0.1')?.value).toBe(10)
	})

	it('ignores nodes that are not Parameters', () => {
		const node = { contents: { type: ElementType.Node } } as any
		state.updateParameterMap('0.1', node)
		expect(state.parameters.has('0.1')).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// getCurrentEnumValue
// ---------------------------------------------------------------------------

describe('getCurrentEnumValue', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
	})

	it('returns the correct enum string for a valid index', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn\nStandby', value: 1 }))
		expect(state.getCurrentEnumValue('0.1')).toBe('On')
	})

	it('returns first entry for index 0', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn', value: 0 }))
		expect(state.getCurrentEnumValue('0.1')).toBe('Off')
	})

	it('returns empty string when index is out of range', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn', value: 5 }))
		expect(state.getCurrentEnumValue('0.1')).toBe('')
	})

	it('returns empty string when enumeration is missing', () => {
		state.updateParameterMap('0.1', makeNode({ value: 0 }))
		expect(state.getCurrentEnumValue('0.1')).toBe('')
	})

	it('returns empty string when value is undefined', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn', value: undefined }))
		expect(state.getCurrentEnumValue('0.1')).toBe('')
	})

	it('returns empty string for unknown path', () => {
		expect(state.getCurrentEnumValue('9.9.9')).toBe('')
	})
})

// ---------------------------------------------------------------------------
// getEnumIndex
// ---------------------------------------------------------------------------

describe('getEnumIndex', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn\nStandby', value: 0 }))
	})

	it('returns the correct index for a known enum string', () => {
		expect(state.getEnumIndex('0.1', 'On')).toBe(1)
	})

	it('returns 0 for the first enum entry', () => {
		expect(state.getEnumIndex('0.1', 'Off')).toBe(0)
	})

	it('returns undefined for a string not in the enumeration', () => {
		expect(state.getEnumIndex('0.1', 'Unknown')).toBeUndefined()
	})

	it('returns undefined when path has no enumeration', () => {
		state.updateParameterMap('0.2', makeNode({ value: 0 }))
		expect(state.getEnumIndex('0.2', 'Off')).toBeUndefined()
	})

	it('returns undefined for unknown path', () => {
		expect(state.getEnumIndex('9.9.9', 'Off')).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// getParameter / hasParameter
// ---------------------------------------------------------------------------

describe('getParameter', () => {
	it('returns the parameter for a known path', () => {
		const state = new EmberPlusState()
		state.updateParameterMap('0.1', makeNode({ identifier: 'gain' }))
		expect(state.getParameter('0.1')?.identifier).toBe('gain')
	})

	it('returns undefined for an unknown path', () => {
		expect(new EmberPlusState().getParameter('9.9.9')).toBeUndefined()
	})
})

describe('hasParameter', () => {
	it('returns true for a registered path', () => {
		const state = new EmberPlusState()
		state.updateParameterMap('0.1', makeNode())
		expect(state.hasParameter('0.1')).toBe(true)
	})

	it('returns false for an unregistered path', () => {
		expect(new EmberPlusState().hasParameter('0.1')).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('clear', () => {
	it('empties all maps and sets and resets selected', () => {
		const state = new EmberPlusState()
		state.updateParameterMap('0.1', makeNode())
		state.addIdToPathMap('fb1', '0.1')
		state.monitoredParameters.add('0.1')
		state.matrices.push('0.1')
		state.selected = { source: 1, target: 2, matrix: 3 }

		state.clear()

		expect(state.parameters.size).toBe(0)
		expect(state.emberElement.size).toBe(0)
		expect(state.getFeedbacksByPath('0.1').size).toBe(0)
		expect(state.selected).toEqual({ source: -1, target: -1, matrix: -1 })
	})

	it('can be called on an already-empty state without throwing', () => {
		new EmberPlusState().clear()
	})
})
