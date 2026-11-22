import type { DropdownChoice, SomeCompanionConfigField } from '@companion-module/base'

export const portDefault = 9000

/** What the connection makes variables for, chosen in the Connection Variables option */
export const ConnectionVariable = [
	'parameterValues',
	'parameterStreams',
	'matrixSourceNames',
	'matrixTargetNames',
	'matrixConnections',
] as const
export type ConnectionVariable = (typeof ConnectionVariable)[number]

export const connectionVariableChoices = [
	{ id: 'parameterValues', label: 'Parameter - Values' },
	{ id: 'parameterStreams', label: 'Parameter - Streams' },
	{ id: 'matrixSourceNames', label: 'Matrix - Source Names' },
	{ id: 'matrixTargetNames', label: 'Matrix - Target Names' },
	{ id: 'matrixConnections', label: 'Matrix - Connections' },
] as const satisfies DropdownChoice<ConnectionVariable>[]

/** Parameter values only, for new connections and those upgraded from before the option */
export const connectionVariablesDefault: ConnectionVariable[] = [connectionVariableChoices[0].id]

// A type, not an interface: InstanceTypes requires the config to be a JsonObject, and an interface has no index signature
export type EmberPlusConfig = {
	bonjourHost?: string
	host?: string
	port?: number
	take?: boolean
	matricesString?: string
	monitoredParametersString?: string
	factor: boolean
	/** What the connection makes variables for: parameters' values (or streams), and matrices' names and connections */
	variables: ConnectionVariable[]
	/** Turns on the Ember+ library's debug output, and fuller detail in the module's own debug messages */
	verbose: boolean
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
			tooltip: 'The Hostname/IP of the Ember+ provider',
			width: 6,
			minLength: 1,
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
			multiline: true,
		},
		{
			type: 'textinput',
			id: 'monitoredParametersString',
			label: 'Paths to parameters to monitor',
			tooltip: 'Please separate by comma',
			width: 12,
			multiline: true,
		},
		{
			type: 'multidropdown',
			id: 'variables',
			label: 'Connection Variables',
			width: 12,
			choices: connectionVariableChoices,
			default: connectionVariablesDefault,
			tooltip:
				"Parameter - Values: a variable for each parameter in use, by the configured paths, actions and feedbacks. Parameter - Streams: the same for stream parameters, such as meters, which update many times a second. Without them, use the Parameter Property feedback. Matrix - Target Names and Source Names: each configured matrix's signal names. Matrix - Connections: each target's connected sources. Without them, use the Matrix Property feedback",
		},
		{
			type: 'checkbox',
			id: 'factor',
			label: 'Apply Formula and Factor to Parameter Variables?',
			width: 6,
			default: true,
			tooltip:
				"Variables of number parameters hold the value as displayed: by the parameter's formula, or else divided by its factor. Off, they hold the device's value",
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			width: 6,
			default: false,
			tooltip: "Log the Ember+ library's debug output, and each registered parameter's full contents",
		},
	]
}
