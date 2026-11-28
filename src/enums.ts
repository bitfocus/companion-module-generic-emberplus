import { Model as EmberModel } from '@phillipivan/emberplus-connection'

/** An enumeration entry: the parameter's value for it, and its name as the device gives it */
export interface EnumEntry {
	value: number
	name: string
}

/**
 * A parameter's enumeration entries, from its enumMap or else its enumeration (the library's enumEntries), in their
 * order, each named as the device names it. The library marks an entry whose name begins with "~" as hidden (one that
 * "shall not be displayed in a user interface") and drops the "~". A generic module can't know why a device hides an
 * entry, and its actions and feedbacks work on any enumeration, so every entry is offered, and keeps its "~", as before
 * 3.0.
 */
export function enumEntries(parameter: EmberModel.Parameter): EnumEntry[] {
	return EmberModel.enumEntries(parameter).map(({ value, label, hidden }) => ({
		value,
		name: hidden ? `~${label}` : label,
	}))
}

/** The name of the entry of the parameter's value, as the device names it; undefined for a value with no entry */
export function enumEntryName(parameter: EmberModel.Parameter): string | undefined {
	return enumEntries(parameter).find((entry) => entry.value === parameter.value)?.name
}

/**
 * The value of the parameter's entry of a name; undefined for a name with no entry. An entry whose name begins with "~"
 * matches with it or without it, as it may have been typed either way; an entry of exactly the name comes first.
 */
export function enumEntryValue(parameter: EmberModel.Parameter, name: string): number | undefined {
	const entries = enumEntries(parameter)
	return (entries.find((entry) => entry.name === name) ?? entries.find((entry) => entry.name === `~${name}`))?.value
}
