import { Regex } from '@companion-module/base'
import type { SomeCompanionConfigField } from '@companion-module/base'
import { LoggerLevel, loggerLevelChoices } from './logger.js'

export const portDefault = 9000

export interface EmberPlusConfig {
	bonjourHost?: string
	host?: string
	port?: number
	take?: boolean
	matrices?: string[]
	matricesString?: string
	monitoredParametersString?: string
	monitoredParameters?: string[]
	factor: boolean
	logging: LoggerLevel
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'bonjour-device',
			id: 'bonjourHost',
			label: 'Device',
			width: 6,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target Host',
			tooltip: 'The Hostname/IP of the ember+ provider',
			width: 6,
			regex: Regex.HOSTNAME,
			isVisibleExpression: `!$(options:bonjourHost)`,
		},
		{
			type: 'static-text',
			id: 'host-filler',
			width: 6,
			label: '',
			isVisibleExpression: `!!$(options:bonjourHost)`,
			value: '',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Target Port',
			tooltip: 'Usually 9000 by default',
			width: 6,
			min: 1,
			max: 0xffff,
			step: 1,
			default: portDefault,
			isVisibleExpression: `!$(options:bonjourHost)`,
		},
		{
			type: 'static-text',
			id: 'port-filler',
			width: 6,
			label: '',
			isVisibleExpression: `!!$(options:bonjourHost)`,
			value: '',
		},
		{
			type: 'checkbox',
			id: 'take',
			label: 'Enable Auto-Take?',
			width: 6,
			default: false,
		},
		{
			type: 'textinput',
			id: 'matricesString',
			label: 'Paths to matrices',
			tooltip: 'Please separate by comma',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'monitoredParametersString',
			label: 'Paths to parameters to monitor',
			tooltip: 'Please separate by coma',
			width: 12,
		},
		{
			type: 'checkbox',
			id: 'factor',
			label: 'Factorise Integer Parameter Variables?',
			width: 6,
			default: true,
			tooltip: 'Variables from Integer Parameters will be divided by the Factor field where reported',
		},
		{
			type: 'dropdown',
			id: 'logging',
			label: 'Minimum Log Level',
			default: LoggerLevel.Information,
			choices: loggerLevelChoices,
			allowCustom: false,
			width: 8,
		},
	]
}
