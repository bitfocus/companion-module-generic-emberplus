import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionEvent,
} from '@companion-module/base'
import { EmberClient, Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import type PQueue from 'p-queue'
import type { InvokeFunctionOptions } from '../actions.js'
import type EmberPlusInstance from '../index.js'
import { describe } from '../logging.js'
import { EmberPlusState } from '../state.js'
import { parseEscapeCharacters, parseFunctionArguments, resolveEventPath } from '../util.js'

const logger = createModuleLogger('Actions/Invoke Function')

function isFunctionNode(
	node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined,
): node is EmberTypes.ElementOf<EmberModel.EmberFunction> {
	return (
		node?.contents.type === EmberModel.ElementType.Function &&
		(EmberModel.isNumbered(node) || EmberModel.isQualified(node))
	)
}

export const invokeFunctionAction =
	(self: EmberPlusInstance, emberClient: EmberClient, state: EmberPlusState, queue: PQueue) =>
	async (
		action: CompanionActionEvent<InvokeFunctionOptions>,
		context: CompanionActionCallbackContext,
	): Promise<void> => {
		const path = resolveEventPath(action)
		if (!path) {
			logger.warn('Invoke Function: Path is empty')
			return
		}

		await queue.add(
			async () => {
				try {
					let node = state.emberElement.get(path)
					if (!node) {
						node = await emberClient.getElementByPath(path)
						// Not cached when a host change has replaced the client it came from
						if (node && self.isCurrentClient(emberClient)) {
							state.emberElement.set(path, node)
							if (node.contents.type === EmberModel.ElementType.Function) {
								state.updateFunctionMap(path, node)
							}
						}
					}

					if (!isFunctionNode(node)) {
						logger.error(`Invoke Function: Node at path "${path}" is not a valid Ember+ Function`)
						return
					}

					// Companion has already replaced any variables in the arguments
					const argsString = action.options.args ?? ''
					const finalArgsString = action.options.parseEscapeChars ? parseEscapeCharacters(argsString) : argsString

					const emberFunc = node.contents
					const typedArgs = parseFunctionArguments(finalArgsString, emberFunc.args)

					logger.debug(`Invoking Ember+ Function at "${path}" with arguments: ${describe(typedArgs)}`)

					const request = await emberClient.invoke(node, ...typedArgs)
					const result = await request.response

					// A result that leaves out success is a success (the library reads it as libember does)
					if (result?.success) {
						logger.info(`Function "${path}" invoked successfully: ${describe(result.result ?? '')}`)
					} else {
						logger.warn(`Function "${path}" invocation failed or returned false: ${describe(result ?? '')}`)
					}
				} catch (e) {
					logger.error(`Failed to invoke function at "${path}": ${describe(e)}`)
				}
			},
			{ signal: context.signal },
		)
	}
