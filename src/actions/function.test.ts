import { describe, it, expect, vi } from 'vitest'
import { invokeFunctionAction } from './function.js'
import { Model as EmberModel } from 'emberplus-connection'
import { ElementType } from 'emberplus-connection/dist/model/index.js'

// `../util.js` (imported by `./function.js`) circularly imports `../actions.js` for `ActionId`.
// Mock it here, the same way `util.test.ts` does, so loading it doesn't pull in the real
// actions.js -> matrix.js -> feedback.js chain, which reads `comparitorOptions` from util.js
// before that module has finished initializing.
vi.mock('../actions.js', () => ({
	ActionId: {
		SetValueBoolean: 'setValueBoolean',
		SetValueInt: 'setValueInt',
		SetValueReal: 'setValueReal',
		SetValueEnum: 'setValueEnum',
		SetValueString: 'setValueString',
	},
}))

describe('invokeFunctionAction callback', () => {
	it('invokes emberClient.invoke with correctly parsed arguments', async () => {
		const mockSelf: any = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
		const mockResponse = Promise.resolve({ success: true, result: [] })
		const mockEmberClient: any = {
			getElementByPath: vi.fn(),
			invoke: vi.fn().mockResolvedValue({ response: mockResponse }),
		}
		const funcNode: any = {
			contents: {
				type: ElementType.Function,
				identifier: 'MyFunc',
				args: [{ type: EmberModel.ParameterType.Integer, name: 'id' }],
			},
		}
		const mockState: any = {
			emberElement: new Map([['1.2.3', funcNode]]),
			updateFunctionMap: vi.fn(),
		}
		const mockQueue: any = {
			add: vi.fn().mockImplementation((fn: any) => fn()),
		}

		const callback = invokeFunctionAction(mockSelf, mockEmberClient, mockState, mockQueue)

		const action: any = {
			options: {
				path: '1.2.3',
				usePathVar: false,
				args: '42',
				parseEscapeChars: true,
			},
		}

		const context: any = {
			parseVariablesInString: vi.fn().mockImplementation(async (str) => str),
		}

		await callback(action, context)

		expect(mockEmberClient.invoke).toHaveBeenCalledWith(funcNode, { type: EmberModel.ParameterType.Integer, value: 42 })
		expect(mockSelf.logger.info).toHaveBeenCalledWith('Function "1.2.3" invoked successfully', [])
	})

	it('logs warning when path is empty', async () => {
		const mockSelf: any = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
		const mockEmberClient: any = { invoke: vi.fn() }
		const mockState: any = { emberElement: new Map() }
		const mockQueue: any = { add: vi.fn().mockImplementation((fn: any) => fn()) }

		const callback = invokeFunctionAction(mockSelf, mockEmberClient, mockState, mockQueue)
		const action: any = { options: { path: '', usePathVar: false, args: '' } }
		const context: any = { parseVariablesInString: vi.fn().mockImplementation(async (str) => str) }

		await callback(action, context)

		expect(mockSelf.logger.warn).toHaveBeenCalledWith('Invoke Function: Path is empty')
		expect(mockEmberClient.invoke).not.toHaveBeenCalled()
	})

	it('logs error when target node is not a Function', async () => {
		const mockSelf: any = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
		const mockEmberClient: any = { invoke: vi.fn() }
		const paramNode: any = {
			contents: {
				type: ElementType.Parameter,
				identifier: 'Param1',
			},
		}
		const mockState: any = {
			emberElement: new Map([['1.2.3', paramNode]]),
			updateFunctionMap: vi.fn(),
		}
		const mockQueue: any = { add: vi.fn().mockImplementation((fn: any) => fn()) }

		const callback = invokeFunctionAction(mockSelf, mockEmberClient, mockState, mockQueue)
		const action: any = { options: { path: '1.2.3', usePathVar: false, args: '' } }
		const context: any = { parseVariablesInString: vi.fn().mockImplementation(async (str) => str) }

		await callback(action, context)

		expect(mockSelf.logger.error).toHaveBeenCalledWith(
			'Invoke Function: Node at path "1.2.3" is not a valid Ember+ Function',
		)
		expect(mockEmberClient.invoke).not.toHaveBeenCalled()
	})
})
