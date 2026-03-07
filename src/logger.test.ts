import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Logger, LoggerLevel, loggerLevelChoices } from './logger.js'

vi.mock('@companion-module/base', () => ({
	InstanceBase: class {},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSelf() {
	return { log: vi.fn() } as any
}

// ---------------------------------------------------------------------------
// loggerLevelChoices
// ---------------------------------------------------------------------------

describe('loggerLevelChoices', () => {
	it('contains entries for Warning, Information, Debug, Console', () => {
		const ids = loggerLevelChoices.map((c) => c.id)
		expect(ids).toContain(LoggerLevel.Warning)
		expect(ids).toContain(LoggerLevel.Information)
		expect(ids).toContain(LoggerLevel.Debug)
		expect(ids).toContain(LoggerLevel.Console)
	})

	it('does not contain Error level', () => {
		const ids = loggerLevelChoices.map((c) => c.id)
		expect(ids.includes(LoggerLevel.Error)).toBe(false)
	})

	it('every entry has an id and label', () => {
		loggerLevelChoices.forEach((choice) => {
			expect(choice).toHaveProperty('id')
			expect(choice).toHaveProperty('label')
		})
	})
})

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

describe('Logger constructor', () => {
	it('defaults to Information level', () => {
		const self = makeSelf()
		const logger = new Logger(self)
		// Information level should log, Debug should not
		logger.info('test')
		expect(self.log).toHaveBeenCalled()
		self.log.mockClear()
		logger.debug('test')
		expect(self.log.mock.calls.length).toBe(0)
	})

	it('respects a custom log level passed to constructor', () => {
		const self = makeSelf()
		const logger = new Logger(self, LoggerLevel.Warning)
		logger.info('test')
		expect(self.log.mock.calls.length).toBe(0)
		logger.warn('test')
		expect(self.log).toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// log() — level filtering
// ---------------------------------------------------------------------------

describe('Logger.log level filtering', () => {
	it('logs messages at or below the minimum level', () => {
		const self = makeSelf()
		const logger = new Logger(self, LoggerLevel.Information)
		expect(logger.log(LoggerLevel.Error, 'err')).toBe(true)
		expect(logger.log(LoggerLevel.Warning, 'warn')).toBe(true)
		expect(logger.log(LoggerLevel.Information, 'info')).toBe(true)
	})

	it('discards messages above the minimum level', () => {
		const self = makeSelf()
		const logger = new Logger(self, LoggerLevel.Information)
		expect(logger.log(LoggerLevel.Debug, 'debug')).toBe(false)
		expect(logger.log(LoggerLevel.Console, 'console')).toBe(false)
		expect(self.log.mock.calls.length).toBe(0)
	})

	it('returns false without calling self.log when filtered', () => {
		const self = makeSelf()
		const logger = new Logger(self, LoggerLevel.Error)
		logger.log(LoggerLevel.Warning, 'should be filtered')
		expect(self.log.mock.calls.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// log() — Companion log level mapping
// ---------------------------------------------------------------------------

describe('Logger.log Companion level mapping', () => {
	it('maps Error to "error"', () => {
		const self = makeSelf()
		new Logger(self, LoggerLevel.Error).log(LoggerLevel.Error, 'msg')
		expect(self.log).toHaveBeenCalledWith('error', 'msg')
	})

	it('maps Warning to "warn"', () => {
		const self = makeSelf()
		new Logger(self, LoggerLevel.Warning).log(LoggerLevel.Warning, 'msg')
		expect(self.log).toHaveBeenCalledWith('warn', 'msg')
	})

	it('maps Information to "info"', () => {
		const self = makeSelf()
		new Logger(self, LoggerLevel.Information).log(LoggerLevel.Information, 'msg')
		expect(self.log).toHaveBeenCalledWith('info', 'msg')
	})

	it('maps Debug to "debug"', () => {
		const self = makeSelf()
		new Logger(self, LoggerLevel.Debug).log(LoggerLevel.Debug, 'msg')
		expect(self.log).toHaveBeenCalledWith('debug', 'msg')
	})
})

// ---------------------------------------------------------------------------
// log() — Console level
// ---------------------------------------------------------------------------

describe('Logger.log Console level', () => {
	it('writes to console.log instead of self.log', () => {
		const self = makeSelf()
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const logger = new Logger(self, LoggerLevel.Console)
		logger.log(LoggerLevel.Console, 'console msg')
		expect(consoleSpy).toHaveBeenCalledWith('console msg')
		expect(self.log.mock.calls.length).toBe(0)
		consoleSpy.mockRestore()
	})
})

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

describe('Logger convenience methods', () => {
	let self: ReturnType<typeof makeSelf>
	let logger: Logger

	beforeEach(() => {
		self = makeSelf()
		logger = new Logger(self, LoggerLevel.Console)
	})

	it('error() calls self.log with "error"', () => {
		logger.error('oops')
		expect(self.log).toHaveBeenCalledWith('error', 'oops')
	})

	it('warn() calls self.log with "warn"', () => {
		logger.warn('careful')
		expect(self.log).toHaveBeenCalledWith('warn', 'careful')
	})

	it('info() calls self.log with "info"', () => {
		logger.info('hello')
		expect(self.log).toHaveBeenCalledWith('info', 'hello')
	})

	it('debug() calls self.log with "debug"', () => {
		logger.debug('details')
		expect(self.log).toHaveBeenCalledWith('debug', 'details')
	})

	it('console() writes to console.log', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		logger.console('raw output')
		expect(spy).toHaveBeenCalledWith('raw output')
		spy.mockRestore()
	})
})

// ---------------------------------------------------------------------------
// buildMsgString (tested via public methods)
// ---------------------------------------------------------------------------

describe('buildMsgString via public methods', () => {
	let self: ReturnType<typeof makeSelf>
	let logger: Logger

	beforeEach(() => {
		self = makeSelf()
		logger = new Logger(self, LoggerLevel.Debug)
	})

	it('joins multiple string arguments with spaces', () => {
		logger.info('hello', 'world')
		expect(self.log).toHaveBeenCalledWith('info', 'hello world')
	})

	it('stringifies objects with JSON.stringify', () => {
		logger.info({ key: 'value' })
		expect(self.log).toHaveBeenCalledWith('info', '{"key":"value"}')
	})

	it('coerces numbers to strings', () => {
		logger.info(42)
		expect(self.log).toHaveBeenCalledWith('info', '42')
	})

	it('coerces booleans to strings', () => {
		logger.info(true)
		expect(self.log).toHaveBeenCalledWith('info', 'true')
	})

	it('handles mixed types in a single call', () => {
		logger.info('value:', 42, { ok: true })
		expect(self.log).toHaveBeenCalledWith('info', 'value: 42 {"ok":true}')
	})

	it('handles a single empty string', () => {
		logger.info('')
		expect(self.log).toHaveBeenCalledWith('info', '')
	})

	it('handles circular references without throwing', () => {
		const obj: any = { a: 1 }
		obj.self = obj
		let threw = false
		try {
			logger.info(obj)
		} catch {
			threw = true
		}
		expect(threw).toBe(false)
	})
})
