import {
	combineRgb,
	createModuleLogger,
	type CompanionGraphicsElementValue,
	type CompanionLayeredButtonPresetDefinition,
	type CompanionPresetDefinitions,
	type CompanionPresetFeedbackStyleOverride,
	type CompanionPresetGroup,
	type CompanionPresetLocalVariable,
	type CompanionVariableValues,
	type HorizontalAlignment,
	type SomeButtonGraphicsElement,
	type SomePresetActionEntry,
	type VerticalAlignment,
} from '@companion-module/base'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import type { CompositeElementSchema } from '../composites.js'
import { FeedbackId } from '../feedback.js'
import type { ParameterProperty } from '../feedbacks/property.js'
import type { ModuleTypes } from '../index.js'
import { identifiersOf } from '../identifiers.js'
import type { EmberPlusState } from '../state.js'

/*
 * What the preset sections share, as in companion-module-generic-oca's and companion-module-stagetec-nexus-udp's
 * presets/consts.ts, so their buttons look alike.
 *
 * Each kind of button is one template preset, whose `path` local variable Companion fills in for each parameter from
 * the template group (templateGroups), as companion-module-stagetec-nexus-udp's presets fill in an input. A button that
 * stays linked to its preset then still lets its template variables be changed: its path, and the group's common
 * values, the button's other simple variables (font sizes, steps). Whatever else it shows of the parameter (its path by
 * identifiers, its range, its step) it reads through Parameter Property, from the path.
 */

export const logger = createModuleLogger('Presets')

export type Element = SomeButtonGraphicsElement<CompositeElementSchema>
export type LocalVariable = CompanionPresetLocalVariable<ModuleTypes['feedbacks']>
export type Preset = CompanionLayeredButtonPresetDefinition<ModuleTypes>
export type Presets = CompanionPresetDefinitions<ModuleTypes>
export type PresetGroup = CompanionPresetGroup<ModuleTypes>
export type PresetAction = SomePresetActionEntry<ModuleTypes>

export const local = (name: string): string => `$(local:${name})`
export const expression = (value: string): { isExpression: true; value: string } => ({ isExpression: true, value })

/** Ids of the button's elements, which the feedbacks' style overrides refer to */
const BACKGROUND_ID = 'background'
export const VALUE_ID = 'value'
export const NAME_ID = 'name'

/**
 * The local variables the buttons share: the parameter's path, the template variable; its path by identifiers, its
 * value, and its value as text, from Parameter Property
 */
export const PATH_VARIABLE = 'path'
export const NAME_VARIABLE = 'name'
export const VALUE_VARIABLE = 'value'
export const TEXT_VARIABLE = 'text'

/** The parameter's path, as the actions' and feedbacks' path takes it: an expression reading the template variable */
export const PATH = expression(local(PATH_VARIABLE))

/** The font sizes of the value, and of the parameter's path, each a local variable to fine tune */
export const VALUE_FONT_SIZE_VARIABLE = 'font_size_value'
export const NAME_FONT_SIZE_VARIABLE = 'font_size_name'

/**
 * The font sizes the variables start at, in Companion's text element units, as a percentage of the button's height: a
 * text element here spans the whole button, and is aligned within it
 */
export const VALUE_FONT_SIZE = 24
export const NAME_FONT_SIZE = 16

/** The dial arc's colour: a generic parameter has no conventional one, so the grey of companion-module-generic-oca's */
export const DIAL_COLOR = combineRgb(182, 182, 182)

/** The colours a toggle turns while on */
export interface ActiveColors {
	readonly background: number
	/** The text's colour, where white won't do */
	readonly text?: number
}

/**
 * Whether a value from a feedback is known: a number, and not null, which Parameter Property gives for a value not yet
 * reported. Companion's isNumber takes null for 0, so both are checked
 */
export function known(value: string): string {
	return `${value} != null && isNumber(${value})`
}

/** A local variable holding a property of the button's parameter, from the Parameter Property feedback */
export function propertyVariable(variableName: string, property: ParameterProperty): LocalVariable {
	return {
		variableType: 'feedback',
		variableName,
		feedbackId: FeedbackId.ParameterProperty,
		options: { path: PATH, property },
	}
}

/** A local variable the button starts with, there to change on the button: one of the template group's common values */
export function simpleVariable(variableName: string, startupValue: number | boolean | string): LocalVariable {
	return { variableType: 'simple', variableName, startupValue }
}

/** The button's parameter: its path, which the template group fills in, and its path by identifiers, to show */
export function parameterVariables(): LocalVariable[] {
	return [simpleVariable(PATH_VARIABLE, ''), propertyVariable(NAME_VARIABLE, 'identifierPath')]
}

/** The font sizes of the value and of the parameter's path */
export function fontSizeVariables(valueSize: number = VALUE_FONT_SIZE): LocalVariable[] {
	return [simpleVariable(VALUE_FONT_SIZE_VARIABLE, valueSize), simpleVariable(NAME_FONT_SIZE_VARIABLE, NAME_FONT_SIZE)]
}

export function background(): Element {
	return { type: 'box', id: BACKGROUND_ID, name: 'Background', color: combineRgb(0, 0, 0) }
}

/** White text across the whole button, aligned within it */
function alignedText(
	id: string,
	name: string,
	text: CompanionGraphicsElementValue<string>,
	fontsize: CompanionGraphicsElementValue<number>,
	halign: HorizontalAlignment,
	valign: VerticalAlignment,
): Element {
	return { type: 'text', id, name, text, fontsize, halign, valign, color: combineRgb(255, 255, 255) }
}

/** The parameter's value, from `text` (an expression), its size the value font size variable */
export function valueText(text: string, valign: VerticalAlignment = 'center'): Element {
	return alignedText(VALUE_ID, 'Value', expression(text), expression(local(VALUE_FONT_SIZE_VARIABLE)), 'center', valign)
}

/** The parameter's path by its identifiers, its size the name font size variable */
export function nameText(valign: VerticalAlignment = 'bottom'): Element {
	return alignedText(
		NAME_ID,
		'Name',
		expression(`${local(NAME_VARIABLE)} ?? ''`),
		expression(local(NAME_FONT_SIZE_VARIABLE)),
		'center',
		valign,
	)
}

/**
 * Overrides turning the button to `colors`
 * @param textIds the button's text elements, which take the text colour where there is one
 */
export function activeOverrides(
	colors: ActiveColors,
	textIds: readonly string[],
): CompanionPresetFeedbackStyleOverride[] {
	const overrides = [{ elementId: BACKGROUND_ID, color: colors.background }]
	const { text } = colors
	if (text !== undefined) overrides.push(...textIds.map((elementId) => ({ elementId, color: text })))
	return overrides.map(({ elementId, color }) => ({
		elementId,
		elementProperty: 'color',
		// Wrapped, though the type allows a plain value: Companion 5.1 drops overrides that aren't
		override: { isExpression: false, value: color },
	}))
}

/** A parameter with presets, as the module has registered it */
export interface PresetParameter {
	/** The path it was registered by, which the actions and feedbacks take */
	readonly path: string
	readonly parameter: EmberModel.Parameter
	/** Its path by the identifiers of it and the nodes above it, `Device.Inputs.Gain`, shown along the button */
	readonly name: string
	/** Its parent node's path by identifiers, which the presets are grouped by */
	readonly group: string
}

/**
 * The registered parameters, by their path's identifiers, sorted by them, each element once: a parameter registered
 * by two spellings of its path (1.2.3 and Device.Inputs.Gain) gets one preset. Left out: a parameter offline, or
 * below a node offline. Named by the tree element the state keeps for its presets (parameterElements), which a stream's
 * unsubscribing and a config change leave alone.
 */
export function presetParameters(state: EmberPlusState): PresetParameter[] {
	const byName = new Map<string, PresetParameter>()
	for (const [path, parameter] of state.parameters) {
		const found = identifiersOf(state.parameterElements.get(path), path)
		if (!found || !found.online || parameter.isOnline === false) continue
		const name = found.names.join('.')
		if (byName.has(name)) continue
		byName.set(name, { path, parameter, name, group: found.names.slice(0, -1).join('.') })
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Whether a parameter can be set and read back: read-write access, which a provider has to state (read is the default) */
export function isReadWrite(parameter: EmberModel.Parameter): boolean {
	return parameter.access === EmberModel.ParameterAccess.ReadWrite
}

/** Whether a parameter can be read: read access, the default, or read-write */
export function isReadable(parameter: EmberModel.Parameter): boolean {
	const access = parameter.access ?? EmberModel.ParameterAccess.Read
	return access === EmberModel.ParameterAccess.Read || access === EmberModel.ParameterAccess.ReadWrite
}

/** A group's id: the preset's and its parent node's path, as stable as the path */
function groupId(presetId: string, parent: string): string {
	return parent ? `${presetId}_${parent.replaceAll(/[^A-Za-z0-9_.-]/g, '_')}` : presetId
}

/**
 * `id`, or, where `taken` has it (two paths that differ only in characters an id leaves out, `In 1` and `In_1`), it
 * with the first number from 2 that makes it unique; added to `taken`
 */
function uniqueId(id: string, taken: Set<string>): string {
	let unique = id
	for (let n = 2; taken.has(unique); n++) unique = `${id}_${n}`
	taken.add(unique)
	return unique
}

/** A kind of button: its template preset, by id, and the parameters it is for */
export interface PresetTemplate {
	readonly id: string
	readonly preset: Preset
	readonly accepts: (entry: PresetParameter) => boolean
}

/**
 * The template's simple variables but its path, as the group's common values: what a button linked to its preset may
 * still change, with its path
 */
function commonValuesOf(preset: Preset): CompanionVariableValues {
	return Object.fromEntries(
		(preset.localVariables ?? []).flatMap((variable) =>
			variable.variableType === 'simple' && variable.variableName !== PATH_VARIABLE
				? [[variable.variableName, variable.startupValue]]
				: [],
		),
	)
}

/**
 * Template groups for the parameters given: for each parent node, by its path's identifiers, one per template with
 * parameters, each parameter a button named by its path's identifiers, its path the template variable. The parent's
 * name heads the first; Companion draws each group as a block of its own. Each template used is added to `presets`.
 */
export function templateGroups(
	templates: readonly PresetTemplate[],
	parameters: readonly PresetParameter[],
	presets: Presets,
): PresetGroup[] {
	const byParent = new Map<string, Map<PresetTemplate, PresetParameter[]>>()
	for (const entry of parameters) {
		const template = templates.find((candidate) => candidate.accepts(entry))
		if (!template) continue
		const perTemplate = byParent.get(entry.group) ?? new Map<PresetTemplate, PresetParameter[]>()
		const entries = perTemplate.get(template) ?? []
		entries.push(entry)
		perTemplate.set(template, entries)
		byParent.set(entry.group, perTemplate)
	}
	const groupIds = new Set<string>()
	const groups: PresetGroup[] = []
	for (const [parent, perTemplate] of byParent) {
		let first = true
		for (const template of templates) {
			const entries = perTemplate.get(template)
			if (!entries) continue
			presets[template.id] = template.preset
			groups.push({
				id: uniqueId(groupId(template.id, parent), groupIds),
				type: 'template',
				name: first ? parent || 'Top level' : '',
				presetId: template.id,
				templateVariableName: PATH_VARIABLE,
				templateValues: entries.map(({ name, path }) => ({ name, value: path })),
				commonVariableValues: commonValuesOf(template.preset),
			})
			first = false
		}
	}
	return groups
}
