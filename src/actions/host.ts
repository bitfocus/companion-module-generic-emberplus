import type { CompanionActionEvent, CompanionActionContext, CompanionOptionValues } from '@companion-module/base'
import { type EmberPlusConfig, portDefault } from '../config.js'
import type { EmberPlusInstance } from '../index.js'

export interface setHostActionOptions extends CompanionOptionValues {
	host: string
	port: string
}

export const setHostAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionEvent, context: CompanionActionContext): Promise<void> => {
		const host = (await context.parseVariablesInString(action.options['host']?.toString() ?? '')).trim()
		const portString = (await context.parseVariablesInString(action.options['port']?.toString() ?? '')).trim()

		if (!host && !portString) {
			self.logger.warn('Set Host: Nothing to set')
			return
		}

		let port: number | undefined = undefined
		if (portString) {
			port = Number(portString)
			if (Number.isNaN(port)) throw new Error(`Set Host: Invalid port: ${portString}`)
		}

		await self.setHost(host === '' ? undefined : host, port)
	}

export const learnSetHostActionOptions =
	(config: EmberPlusConfig) =>
	async (action: CompanionActionEvent, _context: CompanionActionContext): Promise<setHostActionOptions> => {
		return {
			...action.options,
			host: config.host ?? '',
			port: (config.port ?? portDefault).toString(),
		}
	}
