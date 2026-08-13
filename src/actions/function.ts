import type { CompanionActionEvent, CompanionActionContext } from '@companion-module/base'
import { EmberClient, Model as EmberModel } from 'emberplus-connection'
import { ElementType } from 'emberplus-connection/dist/model/index.js'
import type PQueue from 'p-queue'
import type { EmberPlusInstance } from '../index.js'
import { EmberPlusState } from '../state.js'
import { parseEscapeCharacters, parseFunctionArguments, resolveEventPath } from '../util.js'

export const invokeFunctionAction =
	(self: EmberPlusInstance, emberClient: EmberClient, state: EmberPlusState, queue: PQueue) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const path = resolveEventPath(action)
		if (!path) {
			self.logger.warn('Invoke Function: Path is empty')
			return
		}

		await queue.add(async () => {
			try {
				let node = state.emberElement.get(path)
				if (!node) {
					node = await emberClient.getElementByPath(path)
					if (node) {
						state.emberElement.set(path, node)
						if (node.contents.type === ElementType.Function) {
							state.updateFunctionMap(path, node)
						}
					}
				}

				if (!node || node.contents.type !== ElementType.Function) {
					self.logger.error(`Invoke Function: Node at path "${path}" is not a valid Ember+ Function`)
					return
				}

				const rawArgsInput = action.options['args']?.toString() ?? ''
				const parsedArgsString = await context.parseVariablesInString(rawArgsInput)
				const finalArgsString = action.options['parseEscapeChars']
					? parseEscapeCharacters(parsedArgsString)
					: parsedArgsString

				const emberFunc = node.contents as EmberModel.EmberFunction
				const typedArgs = parseFunctionArguments(finalArgsString, emberFunc.args)

				self.logger.debug(`Invoking Ember+ Function at "${path}" with arguments:`, typedArgs)

				const request = await emberClient.invoke(node as any, ...typedArgs)
				const result = await request.response

				if (result?.success) {
					self.logger.info(`Function "${path}" invoked successfully`, result.result ?? '')
				} else {
					self.logger.warn(`Function "${path}" invocation failed or returned false`, result ?? '')
				}
			} catch (e) {
				self.logger.error(`Failed to invoke function at "${path}":`, e instanceof Error ? e.message : String(e))
			}
		})
	}
