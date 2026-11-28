import { Model as EmberModel, type EmberClient } from '@phillipivan/emberplus-connection'

/*
 * Discovering parameters, functions and matrices by walking the provider's tree, as far as the Discover Elements
 * Matching patterns lead. Patterns are matched against each element's path, element by element: by its identifier, or
 * by its number. See the notes file, "Future work: discovering parameters from the tree".
 */

/** An element on a path: its number, and its identifier when it has one */
export interface PathElement {
	number: number
	identifier?: string
}

/** One segment of a pattern: `**` (any number of elements), or one element by identifier (with `*`) or number */
type Segment = { deep: true } | { deep: false; identifier: RegExp; number: number | undefined }

interface Pattern {
	text: string
	segments: Segment[]
}

/** The limits a walk stops at: the nodes walked (each a GetDirectory and a subscription), and the parameters found */
export interface DiscoveryLimits {
	nodes: number
	parameters: number
}

/** The default for both limits (the user's call, 2026-11-28) */
export const discoveryLimitDefault = 2048

function segmentOf(text: string): Segment {
	if (text === '**') return { deep: true }
	const escaped = text.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
	return { deep: false, identifier: new RegExp(`^${escaped}$`), number: /^\d+$/.test(text) ? Number(text) : undefined }
}

function segmentMatches(segment: Segment & { deep: false }, element: PathElement): boolean {
	return (
		segment.number === element.number ||
		(element.identifier !== undefined && segment.identifier.test(element.identifier))
	)
}

/** The positions in a pattern reachable from these, a `**` matching no element too */
function closure(segments: Segment[], positions: Set<number>): Set<number> {
	const reached = new Set(positions)
	for (const position of reached) {
		if (segments[position]?.deep) reached.add(position + 1)
	}
	return reached
}

/** The positions in a pattern reached once every element of a path is matched; none when the path can't be matched */
function positionsAfter(segments: Segment[], elements: readonly PathElement[]): Set<number> {
	let positions = closure(segments, new Set([0]))
	for (const element of elements) {
		const next = new Set<number>()
		for (const position of positions) {
			const segment = segments[position]
			if (segment === undefined) continue
			if (segment.deep) next.add(position)
			else if (segmentMatches(segment, element)) next.add(position + 1)
		}
		positions = closure(segments, next)
		if (positions.size === 0) break
	}
	return positions
}

/**
 * The Discover Elements Matching patterns: comma-separated, each a path of elements separated by `.` (or `/`), each
 * element an identifier, where `*` stands for any text (`Channel*`), or a number; `*` alone is any one element, and `**`
 * any number of them, none included. A pattern starting with `!` excludes. An element is discovered when some pattern
 * matches its whole path and no exclude does; with no pattern that includes, nothing is.
 */
export class DiscoveryPatterns {
	readonly includes: readonly Pattern[]
	readonly excludes: readonly Pattern[]

	private constructor(includes: Pattern[], excludes: Pattern[]) {
		this.includes = includes
		this.excludes = excludes
	}

	static parse(text: string | undefined): DiscoveryPatterns {
		const includes: Pattern[] = []
		const excludes: Pattern[] = []
		for (const entry of (text ?? '').split(',')) {
			let pattern = entry.trim().replaceAll('/', '.')
			const exclude = pattern.startsWith('!')
			if (exclude) pattern = pattern.slice(1).trim()
			const parts = pattern.split('.').map((part) => part.trim())
			if (pattern === '' || parts.some((part) => part === '')) continue
			;(exclude ? excludes : includes).push({ text: pattern, segments: parts.map(segmentOf) })
		}
		return new DiscoveryPatterns(includes, excludes)
	}

	/** Whether nothing is to be discovered: no pattern includes anything */
	get isEmpty(): boolean {
		return this.includes.length === 0
	}

	/** Whether an element at this path is to be discovered: some include matches all of it, and no exclude does */
	matches(elements: readonly PathElement[]): boolean {
		const whole = (pattern: Pattern) => positionsAfter(pattern.segments, elements).has(pattern.segments.length)
		return this.includes.some(whole) && !this.excludes.some(whole)
	}

	/**
	 * Whether a node at this path is worth walking: an include could match something below it, and no exclude ending in
	 * `**` takes in all of it
	 */
	shouldWalk(elements: readonly PathElement[]): boolean {
		const below = (pattern: Pattern) =>
			[...positionsAfter(pattern.segments, elements)].some((position) => position < pattern.segments.length)
		const coversAll = (pattern: Pattern) => {
			const last = pattern.segments.length - 1
			return pattern.segments[last]?.deep === true && positionsAfter(pattern.segments, elements).has(last)
		}
		return this.includes.some(below) && !this.excludes.some(coversAll)
	}
}

/** An element found, at its path by numbers and by identifiers */
export interface DiscoveredElement<T extends EmberModel.EmberElement> {
	path: string
	identifierPath: string
	element: EmberModel.NumberedTreeNode<T>
}

/** What a walk found */
export interface Discovered {
	parameters: Array<DiscoveredElement<EmberModel.Parameter>>
	functions: Array<DiscoveredElement<EmberModel.EmberFunction>>
	matrices: Array<DiscoveredElement<EmberModel.Matrix>>
	/** The nodes walked: each a GetDirectory, unless already loaded */
	nodesWalked: number
	/** The limit the walk stopped at, if it did */
	stopped?: keyof DiscoveryLimits
	/** Whether the walk was abandoned: the client was replaced, or a newer walk started */
	abandoned: boolean
}

export interface WalkOptions {
	/** Whether the walk is still wanted; checked after every request */
	isCurrent: () => boolean
	/** Told of a node whose GetDirectory failed; the walk goes on without what is below it */
	onError?: (path: string, error: unknown) => void
	/** How many GetDirectories to have waiting at once */
	concurrency?: number
	/**
	 * The nodes a walk has loaded already, with every field: a later walk sends nothing for them. One the tree has
	 * children for otherwise, as a path lookup loads them (with the provider's default fields, which may leave out the
	 * values), is loaded again
	 */
	loaded?: WeakSet<object>
}

interface Walking {
	node: EmberModel.NumberedTreeNode<EmberModel.EmberNode>
	path: string
	elements: PathElement[]
}

function pathElement(node: EmberModel.NumberedTreeNode<EmberModel.EmberElement>): PathElement {
	const { contents } = node
	const identifier = 'identifier' in contents ? contents.identifier : undefined
	return identifier === undefined ? { number: node.number } : { number: node.number, identifier }
}

/**
 * Walk the provider's tree breadth-first from the top, as far as the patterns lead: a node is walked only while some
 * pattern could match below it, and none excludes all of it. Each node walked is loaded with a GetDirectory asking for
 * every field, unless an earlier walk loaded it (`loaded`), and stays subscribed. A node reporting itself offline isn't walked; one that doesn't
 * say is online, the Glow DTD's default. Breadth-first, so a limit cuts off the deepest levels everywhere, and each
 * level's GetDirectories go a few at a time. Templates aren't followed.
 */
export async function discoverTree(
	client: Pick<EmberClient, 'tree' | 'getDirectory'>,
	patterns: DiscoveryPatterns,
	limits: DiscoveryLimits,
	options: WalkOptions,
): Promise<Discovered> {
	const found: Discovered = { parameters: [], functions: [], matrices: [], nodesWalked: 0, abandoned: false }
	if (patterns.isEmpty) return found
	const concurrency = Math.max(1, options.concurrency ?? 4)

	/** Take in a child: walk it later if a node, record it if a match. False once the parameter limit is reached */
	const take = (
		child: EmberModel.NumberedTreeNode<EmberModel.EmberElement>,
		parent: { path: string; elements: PathElement[] } | undefined,
		next: Walking[],
	): boolean => {
		const path = parent ? `${parent.path}.${child.number}` : `${child.number}`
		const elements = [...(parent?.elements ?? []), pathElement(child)]
		const { contents } = child
		const identifierPath = elements.map((element) => element.identifier ?? String(element.number)).join('.')
		switch (contents.type) {
			case EmberModel.ElementType.Node:
				if (contents.isOnline !== false && patterns.shouldWalk(elements)) {
					next.push({ node: child as EmberModel.NumberedTreeNode<EmberModel.EmberNode>, path, elements })
				}
				return true
			case EmberModel.ElementType.Parameter:
				if (!patterns.matches(elements)) return true
				if (found.parameters.length >= limits.parameters) {
					found.stopped = 'parameters'
					return false
				}
				found.parameters.push({
					path,
					identifierPath,
					element: child as EmberModel.NumberedTreeNode<EmberModel.Parameter>,
				})
				return true
			case EmberModel.ElementType.Function:
				if (patterns.matches(elements)) {
					found.functions.push({
						path,
						identifierPath,
						element: child as EmberModel.NumberedTreeNode<EmberModel.EmberFunction>,
					})
				}
				return true
			case EmberModel.ElementType.Matrix:
				if (patterns.matches(elements)) {
					found.matrices.push({
						path,
						identifierPath,
						element: child as EmberModel.NumberedTreeNode<EmberModel.Matrix>,
					})
				}
				return true
			default:
				// A template, or a command
				return true
		}
	}

	let level: Walking[] = []
	for (const child of client.tree.values()) {
		if (!take(child, undefined, level)) return found
	}

	while (level.length > 0) {
		// The nodes of this level still within the node limit
		const room = limits.nodes - found.nodesWalked
		const walking = level.slice(0, Math.max(0, room))
		if (walking.length < level.length) found.stopped = 'nodes'

		// Load them a few at a time; each one's children are taken in afterwards, in the level's order
		let index = 0
		const load = async (): Promise<void> => {
			while (index < walking.length) {
				const { node, path } = walking[index++]
				found.nodesWalked++
				if (options.loaded?.has(node)) continue
				try {
					// Every field: with the default, a provider may send the children without their values
					await (
						await client.getDirectory(node, EmberModel.FieldFlags.All)
					).response
					options.loaded?.add(node)
				} catch (e) {
					options.onError?.(path, e)
				}
				if (!options.isCurrent()) return
			}
		}
		await Promise.all(Array.from({ length: Math.min(concurrency, walking.length) }, load))
		if (!options.isCurrent()) {
			found.abandoned = true
			return found
		}

		const next: Walking[] = []
		for (const { node, path, elements } of walking) {
			for (const child of node.children?.values() ?? []) {
				if (!take(child, { path, elements }, next)) return found
			}
		}
		if (found.stopped === 'nodes') return found
		level = next
	}
	return found
}
