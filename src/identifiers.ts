import { Model as EmberModel } from '@phillipivan/emberplus-connection'

/**
 * An element's path by identifiers, from the library's tree: each element's identifier, or its number for one without,
 * and whether the element and every node above it are online. A node going offline takes what is below it with it:
 * the specification has a provider report a sub-tree's removal by its parent node's isOnline.
 */
export function identifiersOf(
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

/** An element's path by identifiers, `Device.Inputs.Gain`, from the library's tree; `path` for an element not known */
export function identifierPath(
	node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined,
	path: string,
): string {
	return identifiersOf(node, path)?.names.join('.') ?? path
}

/**
 * An element's label, for a dropdown or a variable's name: its path, then its path by identifiers (its own and every
 * node's above it, as the tree has them), so a long list reads by where each element is, then its description: eg
 * `1.3.2: Inputs.Ch1.Gain (Input gain)`. Its own identifier alone without its tree element; the path alone where
 * nothing has an identifier
 */
export function elementLabel(
	path: string,
	contents: { identifier?: string; description?: string } | undefined,
	element: EmberModel.TreeElement<EmberModel.EmberElement> | undefined,
): string {
	const identifiers = element ? identifierPath(element, path) : contents?.identifier
	let label = path
	if (identifiers && identifiers !== path) label += `: ${identifiers}`
	if (contents?.description) label += ` (${contents.description})`
	return label
}
