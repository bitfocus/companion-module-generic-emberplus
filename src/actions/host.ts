import type { CompanionActionEvent, CompanionActionContext } from '@companion-module/base'
import type { EmberPlusInstance } from '../index.js'

export const setHostAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const host = (await context.parseVariablesInString(action.options['host']?.toString() ?? '')).trim()

		if (!host) {
			self.logger.warn('Set Host: Host is empty')
			return
		}

		await self.setHost(host)
	}
