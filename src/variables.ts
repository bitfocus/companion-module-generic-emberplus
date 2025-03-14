import type { CompanionVariableDefinition } from '@companion-module/base'
import type { EmberPlusConfig } from './config'
import type { EmberPlusState } from './state'
import { ParameterType } from 'emberplus-connection/dist/model'

export function GetVariablesList(config: EmberPlusConfig, state: EmberPlusState): CompanionVariableDefinition[] {
	return (
		config.monitoredParameters?.flatMap((fb) => {
			let fbName = fb
			if (state.parameters.has(fb)) {
				if (state.parameters.get(fb)?.identifier) fbName += `: ${state.parameters.get(fb)?.identifier}`
				if (state.parameters.get(fb)?.description) fbName += ` (${state.parameters.get(fb)?.description})`
			}
			if (state.parameters.get(fb)?.parameterType === ParameterType.Enum) {
				return [
					{
						name: fbName,
						variableId: fb.replaceAll(/[# ]/gm, '_'),
					},
					{
						name: `ENUM: ${fbName}`,
						variableId: `${fb.replaceAll(/[# ]/gm, '_')}_ENUM`,
					},
				]
			}
			return {
				name: fbName,
				variableId: fb.replaceAll(/[# ]/gm, '_'),
			}
		}) ?? []
	)
}
