import { describe, it, expect, vi } from 'vitest'
import { GetConfigFields, portDefault } from './config.js'
import { LoggerLevel } from './logger.js'

vi.mock('@companion-module/base', () => ({
	Regex: {
		HOSTNAME: '/^[a-zA-Z0-9-.]+$/',
	},
}))

vi.mock('./logger.js', () => ({
	LoggerLevel: {
		Information: 'information',
		Warning: 'warning',
		Error: 'error',
	},
	loggerLevelChoices: [
		{ id: 'information', label: 'Information' },
		{ id: 'warning', label: 'Warning' },
		{ id: 'error', label: 'Error' },
	],
}))

// ---------------------------------------------------------------------------
// portDefault
// ---------------------------------------------------------------------------

describe('portDefault', () => {
	it('is 9000', () => {
		expect(portDefault).toBe(9000)
	})
})

// ---------------------------------------------------------------------------
// GetConfigFields
// ---------------------------------------------------------------------------

describe('GetConfigFields', () => {
	const fields = GetConfigFields()

	it('returns an array', () => {
		expect(Array.isArray(fields)).toBe(true)
	})

	it('returns 10 fields', () => {
		expect(fields).toHaveLength(10)
	})

	it('every field has an id and type', () => {
		fields.forEach((field) => {
			expect(field).toHaveProperty('id')
			expect(field).toHaveProperty('type')
		})
	})

	it('all expected ids are present', () => {
		const ids = fields.map((f) => f.id)
		expect(ids).toEqual(
			expect.arrayContaining([
				'bonjourHost',
				'host',
				'host-filler',
				'port',
				'port-filler',
				'take',
				'matricesString',
				'monitoredParametersString',
				'factor',
				'logging',
			]),
		)
	})

	// --- individual field assertions ---

	const get = (id: string) => fields.find((f) => f.id === id) as any

	describe('bonjourHost field', () => {
		it('is a bonjour-device type', () => {
			expect(get('bonjourHost').type).toBe('bonjour-device')
		})
	})

	describe('host field', () => {
		it('is a textinput type', () => {
			expect(get('host').type).toBe('textinput')
		})
		it('has HOSTNAME regex', () => {
			expect(get('host').regex).toBeDefined()
		})
		it('is hidden when bonjourHost is set', () => {
			expect(get('host').isVisibleExpression).toBe('!$(options:bonjourHost)')
		})
	})

	describe('host-filler field', () => {
		it('is visible only when bonjourHost is set', () => {
			expect(get('host-filler').isVisibleExpression).toBe('!!$(options:bonjourHost)')
		})
	})

	describe('port field', () => {
		it('is a number type', () => {
			expect(get('port').type).toBe('number')
		})
		it('defaults to portDefault', () => {
			expect(get('port').default).toBe(portDefault)
		})
		it('has min of 1', () => {
			expect(get('port').min).toBe(1)
		})
		it('has max of 65535', () => {
			expect(get('port').max).toBe(0xffff)
		})
		it('is hidden when bonjourHost is set', () => {
			expect(get('port').isVisibleExpression).toBe('!$(options:bonjourHost)')
		})
	})

	describe('port-filler field', () => {
		it('is visible only when bonjourHost is set', () => {
			expect(get('port-filler').isVisibleExpression).toBe('!!$(options:bonjourHost)')
		})
	})

	describe('take field', () => {
		it('is a checkbox type', () => {
			expect(get('take').type).toBe('checkbox')
		})
		it('defaults to false', () => {
			expect(get('take').default).toBe(false)
		})
	})

	describe('matricesString field', () => {
		it('is a multiline textinput', () => {
			const field = get('matricesString')
			expect(field.type).toBe('textinput')
			expect(field.multiline).toBe(true)
		})
	})

	describe('monitoredParametersString field', () => {
		it('is a multiline textinput', () => {
			const field = get('monitoredParametersString')
			expect(field.type).toBe('textinput')
			expect(field.multiline).toBe(true)
		})
	})

	describe('factor field', () => {
		it('is a checkbox type', () => {
			expect(get('factor').type).toBe('checkbox')
		})
		it('defaults to true', () => {
			expect(get('factor').default).toBe(true)
		})
	})

	describe('logging field', () => {
		it('is a dropdown type', () => {
			expect(get('logging').type).toBe('dropdown')
		})
		it('defaults to LoggerLevel.Information', () => {
			expect(get('logging').default).toBe(LoggerLevel.Information)
		})
		it('does not allow custom values', () => {
			expect(get('logging').allowCustom).toBe(false)
		})
		it('has choices from loggerLevelChoices', () => {
			expect(get('logging').choices).toBeDefined()
			expect(get('logging').choices.length).toBeGreaterThan(0)
		})
	})

	// --- visibility expression pairing ---

	describe('bonjour/host visibility expressions are complementary', () => {
		it('host and host-filler have opposite visibility expressions', () => {
			const host = get('host').isVisibleExpression
			const filler = get('host-filler').isVisibleExpression
			// one negates the other
			expect(filler).toBe(`!${host}`)
		})

		it('port and port-filler have opposite visibility expressions', () => {
			const port = get('port').isVisibleExpression
			const filler = get('port-filler').isVisibleExpression
			expect(filler).toBe(`!${port}`)
		})
	})
})
