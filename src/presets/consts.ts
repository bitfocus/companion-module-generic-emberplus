import {
	combineRgb,
	createModuleLogger,
	type CompanionGraphicsElementValue,
	type CompanionLayeredButtonPresetDefinition,
	type CompanionPresetDefinitions,
	type CompanionPresetFeedbackStyleOverride,
	type CompanionPresetGroup,
	type CompanionPresetLocalVariable,
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
import type { EmberPlusState } from '../state.js'

/*
 * What the preset sections share, as in companion-module-generic-oca's and companion-module-stagetec-nexus-udp's
 * presets/consts.ts, so their buttons look alike.
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

/** The local variables the buttons share: the parameter's value, and its value as text, from Parameter Property */
export const VALUE_VARIABLE = 'value'
export const TEXT_VARIABLE = 'text'

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

/** A local variable holding a property of the parameter at `path`, from the Parameter Property feedback */
export function propertyVariable(variableName: string, path: string, property: ParameterProperty): LocalVariable {
	return {
		variableType: 'feedback',
		variableName,
		feedbackId: FeedbackId.ParameterProperty,
		options: { path, property },
	}
}

/** A local variable the button starts with, there to change on the button */
export function simpleVariable(variableName: string, startupValue: number | boolean): LocalVariable {
	return { variableType: 'simple', variableName, startupValue }
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
export function nameText(name: string, valign: VerticalAlignment = 'bottom'): Element {
	return alignedText(NAME_ID, 'Name', name, expression(local(NAME_FONT_SIZE_VARIABLE)), 'center', valign)
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
 * An element's path by identifiers, from the library's tree: each element's identifier, or its number for one without,
 * and whether the element and every node above it are online. A node going offline takes what is below it with it:
 * the specification has a provider report a sub-tree's removal by its parent node's isOnline.
 */
function identifiersOf(
	node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined,
	path: string,
): { names: string[]; online: boolean } | undefined {
	if (!node) return undefined
	const names: string[] = []
	let online = true
	let element: EmberModel.TreeElement<EmberModel.EmberElement> | undefined = node
	while (element) {
		const { contents } = element
		if ('isOnline' in contents && contents.isOnline === false) online = false
		const identifier = 'identifier' in contents ? contents.identifier : undefined
		if (EmberModel.isQualified(element)) {
			// Reported by its path, which the tree had no place for: its path's numbers are all that is known above it
			names.unshift(identifier ?? element.path)
			if (identifier !== undefined) names.unshift(...element.path.split('.').slice(0, -1))
			break
		}
		names.unshift(identifier ?? (EmberModel.isNumbered(element) ? String(element.number) : path))
		element = element.parent
	}
	return names.length ? { names, online } : { names: [path], online }
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

/** A preset's id: its kind and the parameter's path, as stable as the path */
export function presetId(kind: string, path: string): string {
	return `${kind}_${path.replaceAll(/[^A-Za-z0-9_.-]/g, '_')}`
}

/**
 * The presets built for the parameters given, each added to `presets`, in one group per parent node, named by its
 * path's identifiers. A parameter `build` gives nothing for is left out.
 */
export function parameterGroups(
	kind: string,
	parameters: readonly PresetParameter[],
	build: (entry: PresetParameter) => Preset | undefined,
	presets: Presets,
): PresetGroup[] {
	const groups = new Map<string, string[]>()
	for (const entry of parameters) {
		const preset = build(entry)
		if (!preset) continue
		const id = presetId(kind, entry.path)
		presets[id] = preset
		const ids = groups.get(entry.group) ?? []
		ids.push(id)
		groups.set(entry.group, ids)
	}
	return [...groups].map(([group, ids]) => ({
		id: presetId(kind, group || 'top'),
		type: 'simple',
		name: group || 'Top level',
		presets: ids,
	}))
}

/**
 * A number in the parameter's displayed units: by its formula, or else its factor, as the Set Value actions take it.
 * Undefined for one the formula can't compute.
 */
export function displayed(parameter: EmberModel.Parameter, value: number): number | undefined {
	try {
		const shown = EmberModel.displayValue(parameter, value).value
		return typeof shown === 'number' && Number.isFinite(shown) ? shown : undefined
	} catch {
		return undefined
	}
}

/** A number without float noise, to six significant digits, as a step or a limit a user reads on the button */
export function tidy(value: number): number {
	return Number(value.toPrecision(6))
}
