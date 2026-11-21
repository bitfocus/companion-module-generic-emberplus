import { afterEach, beforeEach, vi } from 'vitest'
import type { LoggingSink } from '@companion-module/base'

/**
 * Capture what the module loggers (createModuleLogger) write, for the tests in the describe block or file it is
 * called in. Companion hands a module its sink as COMPANION_LOGGER; without one, base writes to the console.
 * Each call is (source, level, message).
 */
export function captureLogs(): ReturnType<typeof vi.fn<LoggingSink>> {
	const sink = vi.fn<LoggingSink>()
	beforeEach(() => {
		sink.mockClear()
		globalThis.COMPANION_LOGGER = sink
	})
	afterEach(() => {
		globalThis.COMPANION_LOGGER = undefined
	})
	return sink
}
