import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
} from '@companion-module/base'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedback.js'
import type { EmberPlusConfig } from './config.js'
import { comparitorOptions } from './util'

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
			case OldActionId.SetValueBoolean.toString():
			case OldActionId.SetValueEnum.toString():
			case OldActionId.SetValueInt.toString():
			case OldActionId.SetValueReal.toString():
				action.options.useVar = action.options.useVar === undefined ? false : action.options.useVar
				action.options.variable = action.options.variable === undefined ? false : action.options.variable
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueBooleanVariable.toString():
				action.actionId = ActionId.SetValueBoolean.toString()
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = false
				action.options.variable = action.options.variable === undefined ? false : action.options.variable
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueEnumVariable.toString():
				action.actionId = ActionId.SetValueEnum.toString()
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable = action.options.variable === undefined ? false : action.options.variable
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueIntVariable.toString():
				action.actionId = ActionId.SetValueInt.toString()
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable = action.options.variable === undefined ? false : action.options.variable
				result.updatedActions.push(action)
				break
			case OldActionId.SetValueRealVariable.toString():
				action.actionId = ActionId.SetValueReal.toString()
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable = action.options.variable === undefined ? false : action.options.variable
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case FeedbackId.Parameter.toString():
				feedback.options.valueVar = feedback.options.valueVar === undefined ? '0' : feedback.options.valueVar
				feedback.options.comparitor =
					feedback.options.comparitor === undefined ? comparitorOptions[0].id : feedback.options.comparitor
				feedback.options.useVar = feedback.options.useVar === undefined ? false : feedback.options.useVar
				feedback.options.asInt = feedback.options.asInt === undefined ? false : feedback.options.asInt
				result.updatedFeedbacks.push(feedback)
		}
	}
	return result
}

export const UpgradeScripts: CompanionStaticUpgradeScript<EmberPlusConfig>[] = [convergeSetValueActions]
