import type { CompanionVariableDefinition } from '@companion-module/base'
import type { EmberPlusState } from './state'
import { sanitiseVariableId } from './util'
import { ParameterType } from 'emberplus-connection/dist/model'

export function GetVariablesList(state: EmberPlusState): CompanionVariableDefinition[] {
	if (state.monitoredParameters.size == 0) return []
	const variables = Array.from(state.monitoredParameters).flatMap((fb) => {
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
