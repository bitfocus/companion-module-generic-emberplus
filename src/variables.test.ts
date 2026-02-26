import { describe, it, expect, vi } from 'vitest'
import { GetVariablesList } from './variables'

vi.mock('emberplus-connection/dist/model', () => ({
	ParameterType: {
		Boolean: 'boolean',
		Integer: 'integer',
		Real: 'real',
		Enum: 'enum',
		String: 'string',
	},
}))

vi.mock('./util', () => ({
	sanitiseVariableId: (id: string) => id.replaceAll(/[^a-zA-Z0-9-_.]/gm, '_'),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(monitoredParameters: string[], parameters: Map<string, any> = new Map()): any {
	return {
		monitoredParameters: new Set(monitoredParameters),
		parameters,
	}
}

// ---------------------------------------------------------------------------
// GetVariablesList
// ---------------------------------------------------------------------------

describe('GetVariablesList', () => {
	it('returns empty array when no monitored parameters', () => {
		expect(GetVariablesList(makeState([]))).toEqual([])
	})

	it('returns a variable for a basic monitored parameter with no metadata', () => {
		const state = makeState(['0.1.2'])
		const result = GetVariablesList(state)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({ name: '0.1.2', variableId: '0.1.2' })
	})

	it('appends identifier to name when present', () => {
		const state = makeState(['0.1.2'], new Map([['0.1.2', { identifier: 'gain', parameterType: 'integer' }]]))
		const result = GetVariablesList(state)
		expect(result[0].name).toBe('0.1.2: gain')
	})

	it('appends description in parentheses when present', () => {
		const state = makeState(['0.1.2'], new Map([['0.1.2', { description: 'Main Gain', parameterType: 'integer' }]]))
		const result = GetVariablesList(state)
		expect(result[0].name).toBe('0.1.2 (Main Gain)')
	})

	it('appends both identifier and description when both present', () => {
		const state = makeState(
			['0.1.2'],
			new Map([['0.1.2', { identifier: 'gain', description: 'Main Gain', parameterType: 'integer' }]]),
		)
		const result = GetVariablesList(state)
		expect(result[0].name).toBe('0.1.2: gain (Main Gain)')
	})

	it('returns two entries for Enum parameters — base and _ENUM variant', () => {
		const state = makeState(['0.1.2'], new Map([['0.1.2', { parameterType: 'enum' }]]))
		const result = GetVariablesList(state)
		expect(result).toHaveLength(2)
		expect(result.find((v) => v.variableId === '0.1.2')).toBeDefined()
		expect(result.find((v) => v.variableId === '0.1.2_ENUM')).toBeDefined()
	})

	it('_ENUM variant name is prefixed with "ENUM: "', () => {
		const state = makeState(['0.1.2'], new Map([['0.1.2', { identifier: 'mode', parameterType: 'enum' }]]))
		const result = GetVariablesList(state)
		const enumVar = result.find((v) => v.variableId === '0.1.2_ENUM')
		expect(enumVar?.name).toBe('ENUM: 0.1.2: mode')
	})

	it('sanitises illegal characters in variableId', () => {
		const state = makeState(['0/1/2'])
		const result = GetVariablesList(state)
		expect(result[0].variableId).toBe('0_1_2')
	})

	it('name still uses the original unsanitised path', () => {
		const state = makeState(['0/1/2'])
		const result = GetVariablesList(state)
		expect(result[0].name).toBe('0/1/2')
	})

	it('results are sorted by variableId', () => {
		const state = makeState(['0.3', '0.1', '0.2'])
		const result = GetVariablesList(state)
		const ids = result.map((v) => v.variableId)
		expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
	})

	it('handles multiple parameters of mixed types', () => {
		const state = makeState(
			['0.1', '0.2', '0.3'],
			new Map([
				['0.1', { parameterType: 'boolean' }],
				['0.2', { parameterType: 'enum' }],
				['0.3', { parameterType: 'string' }],
			]),
		)
		const result = GetVariablesList(state)
		// 0.1 → 1 entry, 0.2 → 2 entries (base + _ENUM), 0.3 → 1 entry
		expect(result).toHaveLength(4)
	})

	it('handles a monitored path not present in parameters map', () => {
		// path is monitored but has no entry in parameters — should not throw
		const state = makeState(['9.9.9'])
		const result = GetVariablesList(state)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({ name: '9.9.9', variableId: '9.9.9' })
	})
})
