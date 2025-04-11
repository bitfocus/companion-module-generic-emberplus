import type { CompanionVariableDefinition } from '@companion-module/base'
import type { EmberPlusConfig } from './config'
import type { EmberPlusState } from './state'
import { sanitiseVariableId } from './util'
import { ParameterType } from 'emberplus-connection/dist/model'

export function GetVariablesList(config: EmberPlusConfig, state: EmberPlusState): CompanionVariableDefinition[] {
	config.monitoredParameters?.sort()
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
						variableId: sanitiseVariableId(fb),
					},
					{
						name: `ENUM: ${fbName}`,
						variableId: `${sanitiseVariableId(fb)}_ENUM`,
					},
				]
			}
			return {
				name: fbName,
				variableId: sanitiseVariableId(fb),
			}
		}) ?? []
	)
}
