import { describe, it, expect, vi } from 'vitest'
import { setHostAction } from './host.js'

function makeMocks() {
	const mockSelf: any = {
		logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		setHost: vi.fn().mockResolvedValue(undefined),
	}
	const context: any = { parseVariablesInString: vi.fn().mockImplementation(async (str) => str) }
	return { mockSelf, context }
}

describe('setHostAction callback', () => {
	it('sets the host from the action options', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '192.168.0.1' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1')
	})

	it('resolves variables in the host field', async () => {
		const { mockSelf, context } = makeMocks()
		context.parseVariablesInString.mockResolvedValue('10.0.0.5')

		await setHostAction(mockSelf)({ options: { host: '$(internal:custom_host)' } } as any, context)

		expect(context.parseVariablesInString).toHaveBeenCalledWith('$(internal:custom_host)')
		expect(mockSelf.setHost).toHaveBeenCalledWith('10.0.0.5')
	})

	it('trims surrounding whitespace', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '  192.168.0.1  ' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1')
	})

	it('logs a warning and does nothing when the host is empty', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '   ' } } as any, context)

		expect(mockSelf.logger.warn).toHaveBeenCalledWith('Set Host: Host is empty')
		expect(mockSelf.setHost).not.toHaveBeenCalled()
	})

	it('logs a warning and does nothing when the host option is missing', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: {} } as any, context)

		expect(mockSelf.logger.warn).toHaveBeenCalledWith('Set Host: Host is empty')
		expect(mockSelf.setHost).not.toHaveBeenCalled()
	})
})
