import { describe, it, expect, vi } from 'vitest'
import { setHostAction, learnSetHostActionOptions } from './host.js'

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

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1', undefined)
	})

	it('sets host and port when both are supplied', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '192.168.0.1', port: '9001' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1', 9001)
	})

	it('sets the port only when the host is empty', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '', port: '9001' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith(undefined, 9001)
	})

	it('resolves variables in the host field', async () => {
		const { mockSelf, context } = makeMocks()
		context.parseVariablesInString.mockImplementation(async (str: string) =>
			str === '$(internal:custom_host)' ? '10.0.0.5' : str,
		)

		await setHostAction(mockSelf)({ options: { host: '$(internal:custom_host)' } } as any, context)

		expect(context.parseVariablesInString).toHaveBeenCalledWith('$(internal:custom_host)')
		expect(mockSelf.setHost).toHaveBeenCalledWith('10.0.0.5', undefined)
	})

	it('resolves variables in the port field', async () => {
		const { mockSelf, context } = makeMocks()
		context.parseVariablesInString.mockImplementation(async (str: string) =>
			str === '$(internal:custom_port)' ? '9002' : str,
		)

		await setHostAction(mockSelf)({ options: { host: '192.168.0.1', port: '$(internal:custom_port)' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1', 9002)
	})

	it('trims surrounding whitespace', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '  192.168.0.1  ', port: '  9001  ' } } as any, context)

		expect(mockSelf.setHost).toHaveBeenCalledWith('192.168.0.1', 9001)
	})

	it('throws when the port is not a number', async () => {
		const { mockSelf, context } = makeMocks()

		await expect(
			setHostAction(mockSelf)({ options: { host: '192.168.0.1', port: 'nine thousand' } } as any, context),
		).rejects.toThrow('Set Host: Invalid port: nine thousand')
		expect(mockSelf.setHost).not.toHaveBeenCalled()
	})

	it('propagates errors thrown for an invalid hostname', async () => {
		const { mockSelf, context } = makeMocks()
		mockSelf.setHost.mockRejectedValue(new Error('Set Host: Invalid hostname: not a host!'))

		await expect(setHostAction(mockSelf)({ options: { host: 'not a host!' } } as any, context)).rejects.toThrow(
			'Set Host: Invalid hostname: not a host!',
		)
	})

	it('logs a warning and does nothing when host and port are empty', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: { host: '   ', port: '  ' } } as any, context)

		expect(mockSelf.logger.warn).toHaveBeenCalledWith('Set Host: Nothing to set')
		expect(mockSelf.setHost).not.toHaveBeenCalled()
	})

	it('logs a warning and does nothing when the options are missing', async () => {
		const { mockSelf, context } = makeMocks()

		await setHostAction(mockSelf)({ options: {} } as any, context)

		expect(mockSelf.logger.warn).toHaveBeenCalledWith('Set Host: Nothing to set')
		expect(mockSelf.setHost).not.toHaveBeenCalled()
	})
})

describe('learnSetHostActionOptions', () => {
	it('returns the configured host and port', async () => {
		const { context } = makeMocks()

		const options = await learnSetHostActionOptions({ host: '192.168.0.1', port: 9001 } as any)(
			{ options: { host: '10.0.0.5', port: '9000' } } as any,
			context,
		)

		expect(options).toEqual({ host: '192.168.0.1', port: '9001' })
	})

	it('falls back to the default port when none is configured', async () => {
		const { context } = makeMocks()

		const options = await learnSetHostActionOptions({ host: '192.168.0.1' } as any)(
			{ options: { host: '', port: '' } } as any,
			context,
		)

		expect(options).toEqual({ host: '192.168.0.1', port: '9000' })
	})
})
