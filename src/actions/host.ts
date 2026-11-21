import {
	createModuleLogger,
	type CompanionActionCallbackContext,
	type CompanionActionEvent,
	type CompanionActionLearnContext,
} from '@companion-module/base'
import type { SetHostOptions } from '../actions.js'
import { type EmberPlusConfig, portDefault } from '../config.js'
import type EmberPlusInstance from '../index.js'

const logger = createModuleLogger('Actions/Set Host')

export const setHostAction =
	(self: EmberPlusInstance) =>
	async (action: CompanionActionEvent<SetHostOptions>, _context: CompanionActionCallbackContext): Promise<void> => {
		// Companion has already replaced any variables in the host, and computed an expression in the port. An empty host
		// keeps the current one; a port left out (an action saved without one) keeps the current port
		const host = String(action.options.host ?? '').trim()
		const portText = String(action.options.port ?? '').trim()
		const port = portText === '' ? undefined : Number(portText)

		if (!host && port === undefined) {
			logger.warn('Set Host: Nothing to set')
			return
		}
		if (port !== undefined && Number.isNaN(port)) throw new Error(`Set Host: Invalid port: ${portText}`)

		await self.setHost(host === '' ? undefined : host, port)
	}

export const learnSetHostActionOptions =
	(config: EmberPlusConfig) =>
	async (
		_action: CompanionActionEvent<SetHostOptions>,
		_context: CompanionActionLearnContext,
	): Promise<Partial<SetHostOptions>> => {
		return {
			host: config.host ?? '',
			port: config.port ?? portDefault,
		}
	}
