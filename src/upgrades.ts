import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
} from '@companion-module/base'
import { ActionId } from './actions.js'
import type { EmberPlusConfig } from './config.js'

enum OldActionId {
	SetValueInt = 'setValueInt',
	SetValueIntVariable = 'setValueIntVariable',
	SetValueReal = 'setValueReal',
	SetValueRealVariable = 'setValueRealVariable',
	SetValueString = 'setValueString',
	SetValueBoolean = 'setValueBoolean',
	SetValueBooleanVariable = 'setValueBooleanVariable',
	SetValueEnum = 'setValueEnum',
	SetValueEnumVariable = 'setValueEnumVariable',
	MatrixConnect = 'matrixConnect',
	MatrixDisconnect = 'matrixDisconnect',
	MatrixSetConnection = 'matrixSetConnection',
	Take = 'take',
	Clear = 'clear',
	SetSelectedSource = 'setSelectedSource',
	SetSelectedTarget = 'setSelectedTarget',
}

function convergeSetValueActions(
	_context: CompanionUpgradeContext<EmberPlusConfig>,
	props: CompanionStaticUpgradeProps<EmberPlusConfig>,
): CompanionStaticUpgradeResult<EmberPlusConfig> {
	const result: CompanionStaticUpgradeResult<EmberPlusConfig> = {
		updatedActions: [],
		updatedConfig: null,
		updatedFeedbacks: [],
	}

	for (const action of props.actions) {
		switch (action.actionId) {
			case OldActionId.SetValueBoolean:
			case OldActionId.SetValueEnum:
			case OldActionId.SetValueInt:
			case OldActionId.SetValueReal:
				action.options.useVar = false
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueBooleanVariable:
				action.actionId = ActionId.SetValueBoolean
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = false
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueEnumVariable:
				action.actionId = ActionId.SetValueEnum
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueIntVariable:
				action.actionId = ActionId.SetValueInt
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueRealVariable:
				action.actionId = ActionId.SetValueReal
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				result.updatedActions.push(action)
				break
		}
	}

	return result
}

export const UpgradeScripts: CompanionStaticUpgradeScript<EmberPlusConfig>[] = [convergeSetValueActions]
