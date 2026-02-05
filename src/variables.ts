import type { CompanionVariableDefinition } from '@companion-module/base'
import type { EmberPlusConfig } from './config'
import type { EmberPlusState } from './state'
import { sanitiseVariableId } from './util'
import { ParameterType } from 'emberplus-connection/dist/model'

export function GetVariablesList(config: EmberPlusConfig, state: EmberPlusState): CompanionVariableDefinition[] {
	if (!config.monitoredParameters) return []
	const variables = Array.from(config.monitoredParameters).flatMap((fb) => {
		const fbId = sanitiseVariableId(fb)
		let fbName = fb
		if (state.parameters.has(fb)) {
			if (state.parameters.get(fb)?.identifier) fbName += `: ${state.parameters.get(fb)?.identifier}`
			if (state.parameters.get(fb)?.description) fbName += ` (${state.parameters.get(fb)?.description})`
		}
		if (state.parameters.get(fb)?.parameterType === ParameterType.Enum) {
			return [
				{
					name: fbName,
					variableId: fbId,
				},
				{
					name: `ENUM: ${fbName}`,
					variableId: `${fbId}_ENUM`,
				},
			]
		}
		return {
			name: fbName,
			variableId: fbId,
		}
	})

	return variables.sort((a, b) => a.variableId.localeCompare(b.variableId))
}
