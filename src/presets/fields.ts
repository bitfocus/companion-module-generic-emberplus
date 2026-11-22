import type { Model as EmberModel } from '@phillipivan/emberplus-connection'

/** What a parameter's presets are built from, apart from its path: everything but its value */
const PRESET_FIELDS = [
	'identifier',
	'parameterType',
	'access',
	'isOnline',
	'minimum',
	'maximum',
	'step',
	'factor',
	'formula',
	'format',
	'enumeration',
	'enumMap',
	'streamIdentifier',
] as const satisfies readonly (keyof EmberModel.Parameter)[]

/**
 * Whether two values of a field are alike: the same, or alike when serialised. An enumMap is a Map, which serialises to
 * `{}` whatever it holds, so it is compared entry by entry.
 */
function alike(before: unknown, after: unknown): boolean {
	if (before === after) return true
	if (before instanceof Map && after instanceof Map) {
		return before.size === after.size && [...before].every(([key, value]) => after.get(key) === value)
	}
	return JSON.stringify(before) === JSON.stringify(after)
}

/** Whether a report changed what a parameter's presets are built from, so that they are built again */
export function presetFieldsChanged(previous: EmberModel.Parameter, current: EmberModel.Parameter): boolean {
	return PRESET_FIELDS.some((field) => !alike(previous[field], current[field]))
}
