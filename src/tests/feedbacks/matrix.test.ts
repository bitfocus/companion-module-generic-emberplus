import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import {
	matrixPropertyFeedbackCallback,
	sourceSelectedFeedbackCallback,
	targetSelectedFeedbackCallback,
	unsubscribeMatrixFeedback,
} from '../../feedbacks/matrix.js'
import { EmberPlusState } from '../../state.js'

// `../util.js` circularly imports `../actions.js`; mock it as the other tests do
vi.mock('../../actions.js', () => ({ ActionId: {} }))

/** Matrices 1.4 and 1.5 configured, 1.4 loaded: target 1 connected to source 2, its sources named */
function makeState(): EmberPlusState {
	const state = new EmberPlusState()
	state.setMatrixPaths(['1.4', '1.5'])
	const matrix = new EmberModel.MatrixImpl('router')
	matrix.addressingMode = EmberModel.MatrixAddressingMode.NonLinear
	matrix.targets = new Map([[1, {}]])
	matrix.sources = new Map([[2, { identifier: 'In 2' }]])
	matrix.connections = EmberModel.connectionsOf([{ target: 1, sources: [2] }])
	const info = state.matrices.get('1.4')!
	info.node = new EmberModel.NumberedTreeNodeImpl(4, matrix)
	info.connectionsLoaded = true
	return state
}

function property(options: Record<string, unknown>, id = 'fb1') {
	return {
		id,
		options: { matrix: '1.4', signal: 'target', target_1_4: 1, targetProperty: 'connections', ...options },
	} as any
}

describe('Matrix Property', () => {
	it("gives the chosen matrix's target's or source's property", () => {
		const state = makeState()
		const callback = matrixPropertyFeedbackCallback(state)
		// A 1:N target's one source, a number
		expect(callback(property({}))).toBe(2)
		expect(callback(property({ signal: 'source', source_1_4: 2, sourceProperty: 'label' }))).toBe('In 2')
	})

	it('registers against the matrix it reads, leaving the one it read before, and leaves on unsubscribe', () => {
		const state = makeState()
		const callback = matrixPropertyFeedbackCallback(state)
		callback(property({}))
		expect(state.getMatrixFeedbacks('1.4')).toEqual(new Set(['fb1']))
		// 1.5 isn't loaded yet: nothing to give, but rechecked once it is
		expect(callback(property({ matrix: '1.5', target_1_5: 1 }))).toBeNull()
		expect(state.getMatrixFeedbacks('1.4').size).toBe(0)
		expect(state.getMatrixFeedbacks('1.5')).toEqual(new Set(['fb1']))
		unsubscribeMatrixFeedback(state)({ id: 'fb1' })
		expect(state.getMatrixFeedbacks('1.5').size).toBe(0)
	})

	it.each([
		['a matrix not configured', { matrix: '9.9' }],
		['no target given', { target_1_4: undefined }],
		['a target that is no number', { target_1_4: 'x' }],
	])('gives nothing for %s', (_name, options) => {
		expect(matrixPropertyFeedbackCallback(makeState())(property(options))).toBeNull()
	})
})

describe('selection feedbacks', () => {
	it('are on for the selected target and source of the selected matrix only', () => {
		const state = makeState()
		state.selected = { matrix: '1.4', target: 1, source: 2 }
		const target = targetSelectedFeedbackCallback(state)
		const source = sourceSelectedFeedbackCallback(state)
		expect(target({ options: { matrix: '1.4', target_1_4: 1 } } as any)).toBe(true)
		expect(target({ options: { matrix: '1.4', target_1_4: 2 } } as any)).toBe(false)
		expect(source({ options: { matrix: '1.4', source_1_4: 2 } } as any)).toBe(true)
		// The same numbers on another matrix
		expect(target({ options: { matrix: '1.5', target_1_5: 1 } } as any)).toBe(false)
		expect(source({ options: { matrix: '1.5', source_1_5: 2 } } as any)).toBe(false)
	})

	it('are off with nothing selected, or for a matrix not configured', () => {
		const state = makeState()
		expect(targetSelectedFeedbackCallback(state)({ options: { matrix: '1.4', target_1_4: 1 } } as any)).toBe(false)
		state.selected = { matrix: '1.4', target: 1, source: -1 }
		expect(targetSelectedFeedbackCallback(state)({ options: { matrix: '9.9', target_9_9: 1 } } as any)).toBe(false)
	})
})
