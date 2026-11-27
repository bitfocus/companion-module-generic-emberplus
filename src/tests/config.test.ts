import { describe, it, expect } from 'vitest'
import { GetConfigFields } from '../config.js'

describe('Connection Variables config option', () => {
	const field = GetConfigFields().find((f) => f.id === 'variables')

	it('is a multi-dropdown of the kinds, parameter values by default', () => {
		expect(field).toMatchObject({
			type: 'multidropdown',
			label: 'Connection Variables',
			default: ['parameterValues'],
			choices: [
				{ id: 'parameterValues', label: 'Parameter - Values' },
				{ id: 'parameterStreams', label: 'Parameter - Streams' },
				{ id: 'matrixSourceNames', label: 'Matrix - Source Names' },
				{ id: 'matrixTargetNames', label: 'Matrix - Target Names' },
				{ id: 'matrixConnections', label: 'Matrix - Connections' },
			],
		})
	})

	it('replaced the log level dropdown with the Verbose Logs checkbox', () => {
		const ids = GetConfigFields().map((f) => f.id)
		expect(ids).not.toContain('logging')
		expect(GetConfigFields().find((f) => f.id === 'verbose')).toMatchObject({ type: 'checkbox', default: false })
	})
})

describe('Ramp Step Interval config option', () => {
	it('is a number of ms, 20 to 1000, 50 by default', () => {
		expect(GetConfigFields().find((f) => f.id === 'rampInterval')).toMatchObject({
			type: 'number',
			min: 20,
			max: 1000,
			default: 50,
		})
	})
})
