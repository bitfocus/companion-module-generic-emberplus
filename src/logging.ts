/**
 * A value as text for a log message: text as it is, an Error by its message, anything else as JSON. A Map stringifies
 * as {}, and the library keeps children, connections and enumMaps in Maps, so those become objects first.
 */
export function describe(value: unknown): string {
	if (typeof value === 'string') return value
	if (value instanceof Error) return value.message
	try {
		return (
			JSON.stringify(value, (_key, item: unknown) => (item instanceof Map ? Object.fromEntries(item) : item)) ??
			String(value)
		)
	} catch {
		return '[Unserializable Object]'
	}
}
