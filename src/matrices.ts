import type { DropdownChoice } from '@companion-module/base'
import { type EmberClient, Model as EmberModel, type Types as EmberTypes } from '@phillipivan/emberplus-connection'
import { identifierPath } from './identifiers.js'

/** A matrix in the library's tree, numbered or qualified, which the library can send requests about */
export type MatrixNode = EmberTypes.ElementOf<EmberModel.Matrix>

/** The two kinds of a matrix's signals: its targets (columns) and its sources (rows) */
export type SignalKind = 'target' | 'source'

/** Each signal's label, by its number */
export interface SignalLabels {
	targets: Map<number, string>
	sources: Map<number, string>
}

/** A matrix in the module config, and what has been learnt of it from the provider */
export interface MatrixInfo {
	/** The path as configured: the value the matrix dropdowns store */
	path: string
	/** What the option ids of its target and source fields are built on (matrixOptionKey) */
	key: string
	/** The matrix, once loaded: the library's tree element, which the provider's reports keep up to date */
	node?: MatrixNode
	/**
	 * Whether the matrix's connections are loaded: the provider has answered the GetDirectory on it, which reports every
	 * target's. Until then the library's connections may hold only the targets a report happened to cover (a connect's
	 * reply, a change, or one message of a reply split by target), so a target missing from them isn't one without a
	 * source.
	 */
	connectionsLoaded?: boolean
	/** Each signal's first label, once read */
	labels: SignalLabels
}

export function emptyLabels(): SignalLabels {
	return { targets: new Map(), sources: new Map() }
}

export function isMatrixNode(node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined): node is MatrixNode {
	return (
		node?.contents.type === EmberModel.ElementType.Matrix &&
		(EmberModel.isNumbered(node) || EmberModel.isQualified(node))
	)
}

/**
 * The matrix paths in the module config, comma separated, each once, in the order given. One with an empty segment
 * (`1..4`, `.1`) is left out: no element has such a path, and its fields' key would be another's (matrixOptionKey).
 */
export function matrixPaths(matricesString: string | undefined): string[] {
	return [
		...new Set(
			(matricesString ?? '')
				.replaceAll('/', '.')
				.split(',')
				.map((path) => path.trim())
				.filter((path) => path !== '' && !path.split('.').includes('')),
		),
	]
}

/**
 * The key a matrix's target and source fields are named by (`target_<key>` and so on), from its path alone, so it
 * stays the same whatever else the config holds: letters and digits as they are, each `.` as `_`, and any other
 * character as `__` and its code in six hex digits (enough for any), so `1.4` is `1_4` and `Audio Router` is
 * `Audio__000020Router`. Two paths never share one: an escape is the only `__`, as a configured path has no empty
 * segment (matrixPaths leaves out one that does), so no `..`. The keys are saved in actions and feedbacks, and upgrade
 * scripts write them: a change here needs an upgrade script.
 */
export function matrixOptionKey(path: string): string {
	return [...path]
		.map((char) => {
			if (/[A-Za-z0-9]/.test(char)) return char
			if (char === '.') return '_'
			return `__${(char.codePointAt(0) ?? 0).toString(16).padStart(6, '0')}`
		})
		.join('')
}

/** A matrix's type, by the specification's names: oneToN, the default for a matrix that states none, oneToOne or nToN */
export type MatrixTypeName = 'oneToN' | 'oneToOne' | 'nToN'

export function matrixTypeName(matrix: EmberModel.Matrix): MatrixTypeName {
	switch (matrix.matrixType) {
		case undefined:
		case EmberModel.MatrixType.OneToN:
			return 'oneToN'
		case EmberModel.MatrixType.OneToOne:
			return 'oneToOne'
		case EmberModel.MatrixType.NToN:
			return 'nToN'
		default:
			return unhandledMatrixType(matrix.matrixType)
	}
}

/** A type this version doesn't know, from a newer library: the specification's default */
function unhandledMatrixType(_type: never): MatrixTypeName {
	return 'oneToN'
}

/** Whether a matrix connects any number of sources to a target. Otherwise one at most: 1:N, the default, or 1:1 */
export function isNToN(matrix: EmberModel.Matrix | undefined): boolean {
	return matrix?.matrixType === EmberModel.MatrixType.NToN
}

function signalsOf(matrix: EmberModel.Matrix, kind: SignalKind): EmberModel.Signals | undefined {
	return kind === 'target' ? matrix.targets : matrix.sources
}

/**
 * A matrix's targets or sources, by number, lowest first: those it lists, or, for a linear matrix without a list, 0 to
 * its count − 1 (linear is the default addressing mode)
 */
export function signalNumbers(matrix: EmberModel.Matrix, kind: SignalKind): number[] {
	const listed = signalsOf(matrix, kind)
	if (listed) return [...listed.keys()].sort((a, b) => a - b)
	if (matrix.addressingMode === EmberModel.MatrixAddressingMode.NonLinear) return []
	const count = (kind === 'target' ? matrix.targetCount : matrix.sourceCount) ?? 0
	return Array.from({ length: Math.max(0, count) }, (_, n) => n)
}

/** A signal's contents, as the matrix lists it: identifier, isOnline and labelsLocation, each optional */
export function signalContents(
	matrix: EmberModel.Matrix,
	kind: SignalKind,
	signal: number,
): EmberModel.SignalContents | undefined {
	return signalsOf(matrix, kind)?.get(signal)
}

/** A signal's name: its first label, or else its identifier; undefined for one with neither */
export function signalLabel(info: MatrixInfo, kind: SignalKind, signal: number): string | undefined {
	const label = (kind === 'target' ? info.labels.targets : info.labels.sources).get(signal)
	if (label !== undefined) return label
	const matrix = info.node?.contents
	return matrix ? signalContents(matrix, kind, signal)?.identifier : undefined
}

/** A matrix's targets or sources to choose from, `number: name` (the name trimmed), or the number for one without */
export function signalChoices(info: MatrixInfo, kind: SignalKind): DropdownChoice<number>[] {
	const matrix = info.node?.contents
	if (!matrix) return []
	return signalNumbers(matrix, kind).map((signal) => {
		const label = signalLabel(info, kind, signal)?.trim()
		return { id: signal, label: label ? `${signal}: ${label}` : `${signal}` }
	})
}

/**
 * The matrix as its dropdown names it: the path, and once it is loaded its path by identifiers, the matrix's and every
 * node's above it, `1.4: Audio.Matrix` (the path alone where it is that already)
 */
export function matrixLabel(info: MatrixInfo): string {
	if (!info.node) return info.path
	const name = identifierPath(info.node, info.path)
	return name === info.path ? info.path : `${info.path}: ${name}`
}

/**
 * Whether a failed lookup of a path says the path holds no element, rather than that it couldn't be looked up just
 * now (the connection dropped, or the provider didn't answer): the library's words for a segment it didn't find
 */
export function isNotFound(error: unknown): boolean {
	return error instanceof Error && error.message.startsWith('Could not find node')
}

/**
 * Ask the provider for a matrix's targets, sources and connections, with a GetDirectory on the matrix, which also asks
 * it to report their changes. Resolves with whether it answered: false for a request that wasn't sent (the connection
 * is down), which loads nothing; rejects for one it didn't answer in time.
 */
export async function loadMatrixContents(client: EmberClient, node: MatrixNode): Promise<boolean> {
	const request = await client.getDirectory(node)
	if (!request.response) return false
	await request.response
	return true
}

/** How many label requests go out at once, for labels given by each signal's labelsLocation */
const LabelBatch = 16

/** The first label in a signal's labels node (its labelsLocation): its lowest numbered string parameter */
async function firstLabelAt(client: EmberClient, path: EmberTypes.RelativeOID): Promise<string | undefined> {
	const request = await client.getDirectory(new EmberModel.QualifiedElementImpl(path, new EmberModel.EmberNodeImpl()))
	if (!request.response) throw new Error(`The request for the labels at ${path} was not sent`)
	const reply = await request.response
	const labels = [...(reply.children?.values() ?? [])]
		.filter((child) => child.contents.type === EmberModel.ElementType.Parameter)
		.sort((a, b) => a.number - b.number)
	for (const label of labels) {
		if (label.contents.type === EmberModel.ElementType.Parameter && typeof label.contents.value === 'string') {
			return label.contents.value
		}
	}
	return undefined
}

/**
 * Read a matrix's signal labels, which the specification gives two ways (a provider should use one): the matrix's label
 * sets (its `labels`), a signal's label from the first set that has one; or else each signal's own labels node (its
 * `labelsLocation`), the first label there. The library's tree has to hold the matrix's targets and sources for the
 * second: a GetDirectory on the matrix loads them. A label request that fails is reported through `onError`, and leaves
 * the signal with its label in `previous`, if it had one; the label sets' requests fail together, rejecting.
 */
export async function readSignalLabels(
	client: EmberClient,
	node: MatrixNode,
	onError: (path: string, error: unknown) => void = () => undefined,
	previous?: SignalLabels,
): Promise<SignalLabels> {
	const labels = emptyLabels()
	const matrix = node.contents

	if (matrix.labels?.length) {
		for (const set of await client.getMatrixLabels(node)) {
			for (const [kind, from] of [
				['targets', set.targets],
				['sources', set.sources],
			] as const) {
				for (const [signal, label] of Object.entries(from)) {
					if (!labels[kind].has(Number(signal))) labels[kind].set(Number(signal), label)
				}
			}
		}
		return labels
	}

	const located = (['target', 'source'] as const).flatMap((kind) =>
		[...(signalsOf(matrix, kind)?.entries() ?? [])].flatMap(([signal, contents]) =>
			contents.labelsLocation === undefined ? [] : [{ kind, signal, location: contents.labelsLocation }],
		),
	)
	for (let start = 0; start < located.length; start += LabelBatch) {
		await Promise.all(
			located.slice(start, start + LabelBatch).map(async ({ kind, signal, location }) => {
				const read = kind === 'target' ? labels.targets : labels.sources
				try {
					const label = await firstLabelAt(client, location)
					if (label !== undefined) read.set(signal, label)
				} catch (e) {
					onError(location, e)
					const known = (kind === 'target' ? previous?.targets : previous?.sources)?.get(signal)
					if (known !== undefined) read.set(signal, known)
				}
			}),
		)
	}
	return labels
}

/** A target's properties, for the Matrix Property feedback. Its connection, and that connection's disposition, too */
export const TargetProperty = [
	'label',
	'identifier',
	'isOnline',
	'labelsLocation',
	'connections',
	'disposition',
] as const
export type TargetProperty = (typeof TargetProperty)[number]

/** A source's properties, for the Matrix Property feedback */
export const SourceProperty = ['label', 'identifier', 'isOnline', 'labelsLocation'] as const
export type SourceProperty = (typeof SourceProperty)[number]

export const targetPropertyChoices = [
	{ id: 'label', label: 'Name' },
	{ id: 'identifier', label: 'Identifier' },
	{ id: 'isOnline', label: 'Online' },
	{ id: 'labelsLocation', label: 'Labels Location' },
	{ id: 'connections', label: 'Connected Sources' },
	{ id: 'disposition', label: 'Connection Disposition' },
] as const satisfies DropdownChoice<TargetProperty>[]

export const sourcePropertyChoices = [
	{ id: 'label', label: 'Name' },
	{ id: 'identifier', label: 'Identifier' },
	{ id: 'isOnline', label: 'Online' },
	{ id: 'labelsLocation', label: 'Labels Location' },
] as const satisfies DropdownChoice<SourceProperty>[]

/** What the Matrix Property feedback returns: text, a flag, a source number or numbers, or nothing */
export type MatrixPropertyValue = string | boolean | number | number[] | null

/**
 * A target's connected sources, as the variables and Matrix Property give them: for an N:N matrix their numbers, lowest
 * first (empty for none); for any other, where a target holds one source at most, its number, or null for none (the
 * first, should a provider report more). Null until the matrix's connections are loaded.
 */
export function connectionValue(info: MatrixInfo, target: number): number | number[] | null {
	const sources = connectedSources(info, target)
	if (sources === undefined) return null
	return isNToN(info.node?.contents) ? sources : (sources[0] ?? null)
}

/**
 * The matrix's own name, for its variable: its description, or else its path by identifiers (the matrix's and every
 * node's above it)
 */
export function matrixName(info: MatrixInfo): string {
	return info.node?.contents.description || identifierPath(info.node, info.path)
}

/**
 * An N:N matrix's connection limits, as the specification has them where the matrix states none: the most sources a
 * target takes (its source count), and the most connections in all (its target count times its source count)
 */
export function connectLimits(matrix: EmberModel.Matrix): { perTarget: number; total: number } {
	const sources = matrix.sourceCount ?? signalNumbers(matrix, 'source').length
	const targets = matrix.targetCount ?? signalNumbers(matrix, 'target').length
	return {
		perTarget: matrix.maximumConnectsPerTarget ?? sources,
		total: matrix.maximumTotalConnects ?? targets * sources,
	}
}

/**
 * The matrix's connections, once they are loaded (see MatrixInfo.connectionsLoaded); undefined until then, so a target
 * a report hasn't covered isn't taken for one without a source
 */
export function loadedConnections(info: MatrixInfo): EmberModel.Connections | undefined {
	return info.connectionsLoaded ? info.node?.contents.connections : undefined
}

/** The sources connected to a target, lowest first; undefined until the matrix's connections are loaded */
export function connectedSources(info: MatrixInfo, target: number): number[] | undefined {
	const connections = loadedConnections(info)
	if (!connections) return undefined
	return [...(connections.get(target)?.sources ?? [])].sort((a, b) => a - b)
}

/**
 * A property of a matrix's target or source. The name is the signal's first label, or else its identifier; Online is
 * true unless the provider says otherwise (the DTD's default); Connected Sources are the target's source numbers, and
 * its Connection Disposition the provider's last word on its connection (tally, modified, pending or locked), once the
 * matrix's connections are loaded. Null for a signal the matrix doesn't have, a matrix not loaded, or a property the
 * provider leaves out.
 */
export function signalProperty(
	info: MatrixInfo,
	kind: SignalKind,
	signal: number,
	property: TargetProperty | SourceProperty,
): MatrixPropertyValue {
	const matrix = info.node?.contents
	if (!matrix || !Number.isInteger(signal) || EmberModel.hasSignal(matrix, kind, signal) === false) return null
	const contents = signalContents(matrix, kind, signal)

	switch (property) {
		case 'label':
			return signalLabel(info, kind, signal) ?? null
		case 'identifier':
			return contents?.identifier ?? null
		case 'isOnline':
			return contents?.isOnline ?? true
		case 'labelsLocation':
			return contents?.labelsLocation ?? null
		case 'connections':
			return kind === 'target' ? connectionValue(info, signal) : null
		case 'disposition': {
			const connections = loadedConnections(info)
			if (kind !== 'target' || !connections) return null
			const connection = connections.get(signal)
			if (!connection) return null
			return (connection.disposition ?? EmberModel.ConnectionDisposition.Tally).toLowerCase()
		}
		default:
			return unhandledProperty(property)
	}
}

/** A property this version doesn't know, from a saved feedback: nothing */
function unhandledProperty(_property: never): null {
	return null
}
