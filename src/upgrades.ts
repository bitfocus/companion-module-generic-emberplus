import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
} from '@companion-module/base'
import { ActionId } from './actions.js'
import type { EmberPlusConfig } from './config.js'
import { LoggerLevel } from './logger.js'
import { comparitorOptions } from './util.js'

function v250(
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
			case 'setValueBoolean':
			case 'setValueEnum':
			case 'setValueInt':
			case 'setValueReal':
				action.options.useVar ??= false
				action.options.variable ??= false
				result.updatedActions.push(action)
				break
			case 'setValueBooleanVariable':
				action.actionId = ActionId.SetValueBoolean
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = false
				action.options.variable ??= false
				result.updatedActions.push(action)
				break
			case 'setValueEnumVariable':
				action.actionId = ActionId.SetValueEnum
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable ??= false
				result.updatedActions.push(action)
				break
			case 'setValueIntVariable':
				action.actionId = ActionId.SetValueInt
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable ??= false
				result.updatedActions.push(action)
				break
			case 'setValueRealVariable':
				action.actionId = ActionId.SetValueReal
				action.options.useVar = true
				action.options.valueVar = action.options.value
				action.options.value = 0
				action.options.variable ??= false
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'parameter':
				feedback.options.valueVar ??= '0'
				feedback.options.comparitor ??= comparitorOptions[0].id
				feedback.options.useVar ??= false
				feedback.options.asInt ??= false
				result.updatedFeedbacks.push(feedback)
		}
	}
	return result
}

function v260(
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
			case 'setValueBoolean':
				action.options.toggle ??= false
				result.updatedActions.push(action)
				break
			case 'setValueEnum':
			case 'setValueInt':
			case 'setValueReal':
				action.options.relative ??= false
				action.options.min ??= ''
				action.options.max ??= ''
				result.updatedActions.push(action)
		}
	}
	return result
}

function v270(
	_context: CompanionUpgradeContext<EmberPlusConfig>,
	props: CompanionStaticUpgradeProps<EmberPlusConfig>,
): CompanionStaticUpgradeResult<EmberPlusConfig> {
	const result: CompanionStaticUpgradeResult<EmberPlusConfig> = {
		updatedActions: [],
		updatedConfig: null,
		updatedFeedbacks: [],
	}

	result.updatedConfig = {
		...props.config,
		factor: props.config?.factor ?? false,
		logging: props.config?.logging ?? LoggerLevel.Information,
	}

	for (const action of props.actions) {
		switch (action.actionId) {
			case 'setValueInt':
				action.options.factor ??= '1'
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= true
				result.updatedActions.push(action)
				break
			case 'setValueString':
				action.options.parseEscapeChars ??= false
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= true
				result.updatedActions.push(action)
				break
			case 'setValueReal':
			case 'setValueEnum':
			case 'setValueBoolean':
				action.options.pathVar ??= action.options.path
				action.options.usePathVar ??= true
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'parameter':
				feedback.options.factor ??= '1'
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= false
				result.updatedFeedbacks.push(feedback)
				break
			case 'string':
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= false
				feedback.options.parseEscapeChars ??= false
				result.updatedFeedbacks.push(feedback)
				break
			case 'boolean':
				feedback.options.pathVar ??= feedback.options.path
				feedback.options.usePathVar ??= false
				result.updatedFeedbacks.push(feedback)
				break
		}
	}
	return result
}

function mergeEnumActions(
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
			case 'setValueEnum':
				action.options.asEnum ??= false
				action.options.enumValue ??= ''
				result.updatedActions.push(action)
				break
			case 'setValueEnumLookup':
				action.actionId = 'setValueEnum'
				action.options.enumValue = action.options.value
				action.options.asEnum = true
				action.options.value = 0
				action.options.valueVar = '0'
				action.options.useVar = false
				action.options.relative = false
				action.options.min = '0'
				action.options.max = ''
				result.updatedActions.push(action)
				break
		}
	}
	return result
}

function v280(
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
			case 'matrixConnect':
				action.options.targetVar ??= action.options.target?.toString() ?? '0'
				action.options.useVar ??= false
				result.updatedActions.push(action)
				break
			case 'matrixDisconnect':
				action.options.targetVar ??= action.options.target?.toString() ?? '0'
				action.options.useVar ??= false
				result.updatedActions.push(action)
				break
			case 'matrixSetConnection':
				action.options.targetVar ??= action.options.target?.toString() ?? '0'
				action.options.useVar ??= false
				result.updatedActions.push(action)
				break
			case 'setSelectedSource':
				action.options.matrixVar ??= action.options.matrix?.toString() ?? '0'
				action.options.sourceVar ??= action.options.source?.toString() ?? '0'
				action.options.useVar ??= false
				result.updatedActions.push(action)
				break
			case 'setSelectedTarget':
				action.options.matrixVar ??= action.options.matrix?.toString() ?? '0'
				action.options.targetVar ??= action.options.target?.toString() ?? '0'
				action.options.useVar ??= false
				result.updatedActions.push(action)
				break
		}
	}
	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId) {
			case 'sourceBackgroundSelected':
				feedback.options.useVar ??= false
				feedback.options.sourceVar ??= feedback.options.source?.toString() ?? '0'
				feedback.options.matrixVar ??= feedback.options.matrix?.toString() ?? '0'
				result.updatedFeedbacks.push(feedback)
				break
			case 'targetBackgroundSelected':
				feedback.options.useVar ??= false
				feedback.options.targetVar ??= feedback.options.target?.toString() ?? '0'
				feedback.options.matrixVar ??= feedback.options.matrix?.toString() ?? '0'
				result.updatedFeedbacks.push(feedback)
				break
		}
	}
	return result
}

export const UpgradeScripts: CompanionStaticUpgradeScript<EmberPlusConfig>[] = [
	v250,
	v260,
	v270,
	mergeEnumActions,
	v280,
]
