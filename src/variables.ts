import type { CompanionVariableDefinition } from '@companion-module/base'
import type { EmberPlusConfig } from './config'
import type { EmberPlusState } from './state'

export function GetVariablesList(config: EmberPlusConfig, state: EmberPlusState): CompanionVariableDefinition[] {
	return (
		config.monitoredParameters?.map((fb) => {
			let fbName = fb
			if (state.parameters.has(fb)) {
				if (state.parameters.get(fb)?.identifier) fbName += `: ${state.parameters.get(fb)?.identifier}`
				if (state.parameters.get(fb)?.description) fbName += ` (${state.parameters.get(fb)?.description})`
			}
			return {
				name: fbName,
				variableId: fb.replaceAll(/[# ]/gm, '_'),
			}
		}) ?? []
	)
}
