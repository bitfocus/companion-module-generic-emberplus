import { describe, it, expect, beforeEach } from 'vitest'
import { EmberPlusState } from '../state.js'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'

const { ElementType, ParameterType } = EmberModel

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

function makeFunctionNode(overrides: Record<string, any> = {}) {
	return {
		contents: {
			type: ElementType.Function,
			identifier: 'muteFunction',
			description: 'Mute Channel',
			...overrides,
		},
	} as any
}

// ---------------------------------------------------------------------------
// constructor / initial state
// ---------------------------------------------------------------------------

describe('EmberPlusState constructor', () => {
	it('initialises selected with none', () => {
		const state = new EmberPlusState()
		expect(state.selected).toEqual({ source: -1, target: -1, matrix: '' })
	})

	it('initialises empty parameters map', () => {
		expect(new EmberPlusState().parameters.size).toBe(0)
	})

	it('initialises empty monitoredParameters set', () => {
		expect(new EmberPlusState().monitoredParameters.size).toBe(0)
	})

	it('initialises no matrices', () => {
		expect(new EmberPlusState().matrices.size).toBe(0)
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
		state.updateParameterMap('0.1', {
			contents: { type: ElementType.Parameter, parameterType: ParameterType.Real, value: 10 },
		})
		expect(state.parameters.get('0.1')?.identifier).toBe('level')
		expect(state.parameters.get('0.1')?.value).toBe(10)
	})

	// A merge whose value doesn't fit the type it ends with is no parameter of any type: the report replaces it
	it('takes a report of another type whole when merging would leave a value of the old type', () => {
		state.updateParameterMap('0.1', {
			contents: new EmberModel.ParameterImpl(ParameterType.String, 'label', undefined, 'abc'),
		})
		// Only what the report holds, as a partial report has it
		const report = { type: ElementType.Parameter, parameterType: ParameterType.Integer }
		state.updateParameterMap('0.1', { contents: report } as any)
		expect(state.parameters.get('0.1')).toBe(report)
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

	it('names the current entry from an enumMap', () => {
		state.updateParameterMap(
			'0.1',
			makeNode({
				enumeration: 'Off\nOn',
				value: 20,
				enumMap: new Map([
					['Mute', 10],
					['Live', 20],
				]),
			}),
		)
		expect(state.getCurrentEnumValue('0.1')).toBe('Live')
	})

	// As the device names it, and as before 3.0: the library's enumEntries drops a hidden entry's "~"
	it('names a hidden entry with its ~', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\n~Service', value: 1 }))
		expect(state.getCurrentEnumValue('0.1')).toBe('~Service')
	})

	// Glow 2.50: a null value is none at present. Read as index 0, it gave the first entry
	it('returns empty string when value is null', () => {
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn', value: null }))
		expect(state.getCurrentEnumValue('0.1')).toBe('')
	})
})

// ---------------------------------------------------------------------------
// getEnumIndex
// ---------------------------------------------------------------------------

describe('getEnumValue', () => {
	let state: EmberPlusState

	beforeEach(() => {
		state = new EmberPlusState()
		state.updateParameterMap('0.1', makeNode({ enumeration: 'Off\nOn\nStandby', value: 0 }))
	})

	it('returns the correct index for a known enum string', () => {
		expect(state.getEnumValue('0.1', 'On')).toBe(1)
	})

	it('returns 0 for the first enum entry', () => {
		expect(state.getEnumValue('0.1', 'Off')).toBe(0)
	})

	it('returns undefined for a string not in the enumeration', () => {
		expect(state.getEnumValue('0.1', 'Unknown')).toBeUndefined()
	})

	it('returns undefined when path has no enumeration', () => {
		state.updateParameterMap('0.2', makeNode({ value: 0 }))
		expect(state.getEnumValue('0.2', 'Off')).toBeUndefined()
	})

	it('returns undefined for unknown path', () => {
		expect(state.getEnumValue('9.9.9', 'Off')).toBeUndefined()
	})

	// The library's enumEntries: a device's enumMap, whose values needn't be consecutive, comes before the enumeration
	it('returns the value of an enumMap entry', () => {
		state.updateParameterMap(
			'0.3',
			makeNode({
				enumeration: 'Off\nOn',
				enumMap: new Map([
					['Mute', 10],
					['Live', 20],
				]),
			}),
		)
		expect(state.getEnumValue('0.3', 'Live')).toBe(20)
		expect(state.getEnumValue('0.3', 'On')).toBeUndefined()
	})

	it('finds an entry of exactly the name before a hidden one of it', () => {
		state.updateParameterMap('0.5', makeNode({ enumeration: '~Service\nService' }))
		expect(state.getEnumValue('0.5', 'Service')).toBe(1)
		expect(state.getEnumValue('0.5', '~Service')).toBe(0)
	})

	it('finds a hidden entry with or without its ~', () => {
		state.updateParameterMap('0.4', makeNode({ enumeration: 'Off\n~Service' }))
		expect(state.getEnumValue('0.4', 'Service')).toBe(1)
		expect(state.getEnumValue('0.4', '~Service')).toBe(1)
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
		state.selected = { source: 1, target: 2, matrix: '0.2' }

		state.clear()

		expect(state.parameters.size).toBe(0)
		expect(state.emberElement.size).toBe(0)
		expect(state.parameterElements.size).toBe(0)
		expect(state.getFeedbacksByPath('0.1').size).toBe(0)
		expect(state.selected).toEqual({ source: -1, target: -1, matrix: '' })
	})

	// The next provider's matrices are loaded afresh, but the config still names them, and feedbacks still read them
	it('keeps the matrices configured, and their feedbacks, without what was learnt of them', () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['0.2'])
		const info = state.matrices.get('0.2')!
		info.node = new EmberModel.NumberedTreeNodeImpl(2, new EmberModel.MatrixImpl('router'))
		info.labels.targets.set(1, 'Mon')
		state.addMatrixFeedback('fb1', '0.2')

		state.clear()

		expect([...state.matrices.keys()]).toEqual(['0.2'])
		expect(state.matrices.get('0.2')?.node).toBeUndefined()
		expect(state.matrices.get('0.2')?.labels.targets.size).toBe(0)
		expect(state.getMatrixFeedbacks('0.2')).toEqual(new Set(['fb1']))
	})

	it('can be called on an already-empty state without throwing', () => {
		new EmberPlusState().clear()
	})

	it('clears functions map as well', () => {
		const state = new EmberPlusState()
		state.updateFunctionMap('0.1.2', makeFunctionNode())
		expect(state.functions.size).toBe(1)
		state.clear()
		expect(state.functions.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe('clearCache', () => {
	it('clears emberElement map', () => {
		const state = new EmberPlusState()
		state.updateFunctionMap('0.1.2', makeFunctionNode())
		expect(state.emberElement.size).toBe(1)
		state.clearCache()
		expect(state.emberElement.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// updateFunctionMap / getFunction / hasFunction
// ---------------------------------------------------------------------------

describe('updateFunctionMap / getFunction / hasFunction', () => {
	it('stores function node in functions and emberElement maps', () => {
		const state = new EmberPlusState()
		const funcNode = makeFunctionNode({ identifier: 'fn1' })
		state.updateFunctionMap('1.2.3', funcNode)

		expect(state.hasFunction('1.2.3')).toBe(true)
		expect(state.getFunction('1.2.3')?.identifier).toBe('fn1')
		expect(state.emberElement.get('1.2.3')).toBe(funcNode)
	})

	it('ignores non-function elements', () => {
		const state = new EmberPlusState()
		const paramNode = makeNode()
		state.updateFunctionMap('1.2.3', paramNode)

		expect(state.hasFunction('1.2.3')).toBe(false)
		expect(state.getFunction('1.2.3')).toBeUndefined()
	})

	it('merges data for existing function path', () => {
		const state = new EmberPlusState()
		state.updateFunctionMap('1.2.3', makeFunctionNode({ identifier: 'fn1', description: 'Old' }))
		state.updateFunctionMap('1.2.3', makeFunctionNode({ identifier: 'fn1', description: 'New description' }))

		const stored = state.getFunction('1.2.3')
		expect(stored?.identifier).toBe('fn1')
		expect(stored?.description).toBe('New description')
	})
})

// ---------------------------------------------------------------------------
// matrices
// ---------------------------------------------------------------------------

describe('matrices', () => {
	it('are the paths given, in order, each with the key its fields are named by', () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['1.4', 'Audio.Router'])
		expect([...state.matrices.values()].map(({ path, key }) => [path, key])).toEqual([
			['1.4', '1_4'],
			['Audio.Router', 'Audio_Router'],
		])
	})

	// A config change loads them again: meanwhile their fields keep their choices
	it('keep what was learnt of one still configured', () => {
		const state = new EmberPlusState()
		state.setMatrixPaths(['1.4', '1.5'])
		const node = new EmberModel.NumberedTreeNodeImpl(4, new EmberModel.MatrixImpl('router')) as any
		state.matrices.get('1.4')!.node = node
		state.setMatrixPaths(['1.4'])
		expect(state.matrices.get('1.4')?.node).toBe(node)
		expect(state.matrices.has('1.5')).toBe(false)
	})

	it('register a feedback against the matrix it reads, moving it when edited onto another', () => {
		const state = new EmberPlusState()
		state.addMatrixFeedback('fb1', '1.4')
		state.addMatrixFeedback('fb2', '1.4')
		state.addMatrixFeedback('fb1', '1.5')
		expect(state.getMatrixFeedbacks('1.4')).toEqual(new Set(['fb2']))
		expect(state.getMatrixFeedbacks('1.5')).toEqual(new Set(['fb1']))
		state.removeMatrixFeedback('fb1')
		expect(state.getMatrixFeedbacks('1.5').size).toBe(0)
	})
})
