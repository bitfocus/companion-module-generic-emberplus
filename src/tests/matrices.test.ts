import { describe, it, expect, vi } from 'vitest'
import {
	type ContentsProperty,
	Model as EmberModel,
	type SignalLabel,
	type TreeChange,
	TreeChangeKind,
	type Types as EmberTypes,
} from '@phillipivan/emberplus-connection'
import {
	changedTargets,
	connectionSnapshot,
	applyLabelChanges,
	emptyLabels,
	firstLabels,
	matrixLabel,
	isNotFound,
	loadMatrixContents,
	connectLimits,
	matrixOptionKey,
	matrixTypeName,
	matrixPaths,
	readSignalLabels,
	signalChoices,
	signalNumbers,
	signalLabel,
	signalProperty,
	type MatrixInfo,
} from '../matrices.js'

const { MatrixImpl, MatrixAddressingMode, NumberedTreeNodeImpl, ParameterImpl, ParameterType, EmberNodeImpl } =
	EmberModel

/**
 * A loaded matrix's info, its contents set by `fill`. Connections `fill` gives count as loaded, as the GetDirectory on
 * the matrix loads them
 */
function info(fill: (matrix: EmberModel.MatrixImpl) => void = () => undefined): MatrixInfo {
	const matrix = new MatrixImpl('router')
	fill(matrix)
	return {
		path: '1.4',
		key: '1_4',
		node: new NumberedTreeNodeImpl(4, matrix),
		connectionsLoaded: matrix.connections !== undefined,
		labels: emptyLabels(),
	}
}

describe('connectionSnapshot', () => {
	it("gives each target's sources, lowest first", () => {
		const loaded = info(
			(m) => (m.connections = EmberModel.connectionsOf([{ target: 2, sources: [7, 3] }, { target: 4 }])),
		)
		expect(connectionSnapshot(loaded)).toEqual(
			new Map([
				[2, [3, 7]],
				[4, []],
			]),
		)
	})

	// The library's connections may hold only the targets a report covered
	it("gives none until the matrix's connections are loaded", () => {
		const partial = info((m) => (m.connections = EmberModel.connectionsOf([{ target: 2, sources: [1] }])))
		partial.connectionsLoaded = false
		expect(connectionSnapshot(partial)).toBeUndefined()
		expect(connectionSnapshot(info())).toBeUndefined()
	})
})

describe('changedTargets', () => {
	it('gives the targets whose sources differ, lowest first', () => {
		const before = new Map([
			[1, [1]],
			[2, [1, 2]],
			[3, [4]],
			[5, []],
		])
		const after = new Map([
			[1, [1]],
			[2, [1, 3]],
			[3, []],
			[5, [2]],
			[4, [6]],
		])
		expect(changedTargets(before, after)).toEqual([2, 3, 4, 5])
		expect(changedTargets(after, after)).toEqual([])
	})

	it('counts a source added to the end, or one fewer, as a change', () => {
		expect(changedTargets(new Map([[1, [1]]]), new Map([[1, [1, 2]]]))).toEqual([1])
		expect(changedTargets(new Map([[1, [1, 2]]]), new Map([[1, [1]]]))).toEqual([1])
	})
})

describe('matrixPaths', () => {
	it("reads the config's comma separated paths, each once, slashes as dots", () => {
		expect(matrixPaths(' 1.4, 1/5,, 1.4 ,Audio.Router ')).toEqual(['1.4', '1.5', 'Audio.Router'])
		// No element has a path with an empty segment, and its key would be another's
		expect(matrixPaths('1..4, .1, 1., 2.1')).toEqual(['2.1'])
		expect(matrixPaths(undefined)).toEqual([])
	})
})

describe('matrixOptionKey', () => {
	it("names a matrix's fields by its path, with letters, digits and underscores only", () => {
		expect(matrixOptionKey('1.4')).toBe('1_4')
		expect(matrixOptionKey('Audio Router[1.2]')).toBe('Audio__000020Router__00005b1_2__00005d')
	})

	// From the path alone, so editing the rest of the config never changes a matrix's saved fields
	it('gives paths alike but for their punctuation keys of their own', () => {
		const keys = ['1.4', '1_4', '1-4', '1 4', '1__0020', '\u{1F600}', '\u1F600'].map(matrixOptionKey)
		expect(keys).toEqual([
			'1_4',
			'1__00005f4',
			'1__00002d4',
			'1__0000204',
			'1__00005f__00005f0020',
			// Six digits for any character, so one above U+FFFF can't run into the next
			'__01f600',
			'__001f600',
		])
		expect(new Set(keys).size).toBe(keys.length)
	})
})

describe('isNotFound', () => {
	it("tells the library's not found from a request that failed", () => {
		expect(isNotFound(new Error('Could not find node 5 on given path 1'))).toBe(true)
		expect(isNotFound(new Error('Request timed out'))).toBe(false)
		expect(isNotFound('Could not find node')).toBe(false)
	})
})

describe('loadMatrixContents', () => {
	it('sends a GetDirectory on the matrix, and says whether the provider answered', async () => {
		const { node } = info()
		const answered = { getDirectory: vi.fn().mockResolvedValue({ sentOk: true, response: Promise.resolve(node) }) }
		expect(await loadMatrixContents(answered as never, node!)).toBe(true)
		expect(answered.getDirectory).toHaveBeenCalledWith(node)
		// Not sent, the connection being down
		const unsent = { getDirectory: vi.fn().mockResolvedValue({ sentOk: false }) }
		expect(await loadMatrixContents(unsent as never, node!)).toBe(false)
		const late = {
			getDirectory: vi
				.fn()
				.mockResolvedValue({ sentOk: true, response: Promise.reject(new Error('Request timed out')) }),
		}
		await expect(loadMatrixContents(late as never, node!)).rejects.toThrow('Request timed out')
	})
})

describe('signalNumbers', () => {
	it("lists a matrix's targets and sources, lowest first", () => {
		const { node } = info((matrix) => {
			matrix.targets = new Map([
				[9, {}],
				[2, {}],
			])
		})
		expect(signalNumbers(node!.contents, 'target')).toEqual([2, 9])
	})

	// A linear matrix's signal numbers are its rows and columns, from 0 (linear is the default)
	it("counts a linear matrix's signals without a list", () => {
		const { node } = info((matrix) => {
			matrix.targetCount = 3
			matrix.sourceCount = 2
		})
		expect(signalNumbers(node!.contents, 'target')).toEqual([0, 1, 2])
		expect(signalNumbers(node!.contents, 'source')).toEqual([0, 1])
	})

	it('has none for a non-linear matrix without a list', () => {
		const { node } = info((matrix) => {
			matrix.addressingMode = MatrixAddressingMode.NonLinear
			matrix.targetCount = 3
		})
		expect(signalNumbers(node!.contents, 'target')).toEqual([])
	})
})

describe('signalChoices', () => {
	it('lists each signal by number and name: its first label, or else its identifier', () => {
		const matrix = info((m) => {
			m.sources = new Map([
				[1, { identifier: 'In 1' }],
				[2, { identifier: 'In 2' }],
				[3, {}],
			])
		})
		matrix.labels.sources.set(2, new Map([[0, '  Mic 2  ']]))
		expect(signalChoices(matrix, 'source')).toEqual([
			{ id: 1, label: '1: In 1' },
			{ id: 2, label: '2: Mic 2' },
			{ id: 3, label: '3' },
		])
	})

	it('lists nothing for a matrix not loaded', () => {
		expect(signalChoices({ path: '1.4', key: '1_4', labels: emptyLabels() }, 'target')).toEqual([])
	})
})

describe('matrixTypeName', () => {
	it.each([
		[EmberModel.MatrixType.OneToN, 'oneToN'],
		[EmberModel.MatrixType.OneToOne, 'oneToOne'],
		[EmberModel.MatrixType.NToN, 'nToN'],
		// The specification's default
		[undefined, 'oneToN'],
	])('names %s %s, as the specification does', (matrixType, name) => {
		expect(matrixTypeName(info((m) => (m.matrixType = matrixType)).node!.contents)).toBe(name)
	})
})

describe('connectLimits', () => {
	it("gives an N:N matrix's limits, or the specification's defaults: its sources, and targets times sources", () => {
		const stated = info((m) => {
			m.maximumConnectsPerTarget = 2
			m.maximumTotalConnects = 10
		})
		expect(connectLimits(stated.node!.contents)).toEqual({ perTarget: 2, total: 10 })
		const linear = info((m) => {
			m.targetCount = 4
			m.sourceCount = 3
		})
		expect(connectLimits(linear.node!.contents)).toEqual({ perTarget: 3, total: 12 })
		const listed = info((m) => {
			m.addressingMode = MatrixAddressingMode.NonLinear
			m.targets = new Map([[7, {}]])
			m.sources = new Map([
				[1, {}],
				[9, {}],
			])
		})
		expect(connectLimits(listed.node!.contents)).toEqual({ perTarget: 2, total: 2 })
	})
})

describe('matrixLabel', () => {
	it("names a matrix by its path, and once loaded its path by identifiers, the nodes' above it too", () => {
		expect(matrixLabel({ path: '1.4', key: '1_4', labels: emptyLabels() })).toBe('1.4')
		const loaded = info()
		const audio = new NumberedTreeNodeImpl(1, new EmberNodeImpl('Audio'), EmberModel.childrenOf([loaded.node as never]))
		loaded.node!.parent = audio
		expect(matrixLabel(loaded)).toBe('1.4: Audio.router')
		// A path already by identifiers isn't said twice
		expect(matrixLabel({ ...loaded, path: 'Audio.router' })).toBe('Audio.router')
	})
})

describe('readSignalLabels', () => {
	it("takes a signal's label from the first label set that has one", async () => {
		const matrix = info(
			(m) => (m.labels = [new EmberModel.LabelImpl('1.9', 'Primary'), new EmberModel.LabelImpl('1.8', 'Short')]),
		)
		const client = {
			getMatrixLabels: vi.fn().mockResolvedValue([
				{ basePath: '1.9', description: 'Primary', targets: { 1: 'Studio A' }, sources: {} },
				{ basePath: '1.8', description: 'Short', targets: { 1: 'A', 2: 'B' }, sources: { 5: 'Five' } },
			]),
		}
		const labels = await readSignalLabels(client as never, matrix.node!)
		expect(firstLabels(labels, 'target')).toEqual(
			new Map([
				[1, 'Studio A'],
				[2, 'B'],
			]),
		)
		expect(firstLabels(labels, 'source')).toEqual(new Map([[5, 'Five']]))
		// Every set's label is kept, by the set's place, for a change to any of them
		expect(labels.targets.get(1)).toEqual(
			new Map([
				[0, 'Studio A'],
				[1, 'A'],
			]),
		)
	})

	it("takes the lowest numbered label in each signal's labels node, going on past one that fails", async () => {
		const matrix = info((m) => {
			m.targets = new Map([[1, { labelsLocation: '1.2.1' }]])
			m.sources = new Map([
				[4, { labelsLocation: '1.2.4' }],
				[5, {}],
			])
		})
		const labelsAt = async (path: string) => {
			if (path === '1.2.4') return Promise.reject(new Error('Request timed out'))
			const node = new NumberedTreeNodeImpl(
				1,
				new EmberNodeImpl('labels'),
				EmberModel.childrenOf([
					new NumberedTreeNodeImpl(3, new ParameterImpl(ParameterType.String, 'c', undefined, 'Third')),
					new NumberedTreeNodeImpl(2, new ParameterImpl(ParameterType.Integer, 'b', undefined, 7)),
					new NumberedTreeNodeImpl(1, new EmberNodeImpl('a')),
				]),
			)
			return Promise.resolve(node)
		}
		const client = {
			getDirectory: vi.fn(async (node: { path: string }) => ({ sentOk: true, response: labelsAt(node.path) })),
		}
		const onError = vi.fn()
		const labels = await readSignalLabels(client as never, matrix.node!, onError)
		expect(firstLabels(labels, 'target')).toEqual(new Map([[1, 'Third']]))
		// By the parameter's number
		expect(labels.targets.get(1)).toEqual(new Map([[3, 'Third']]))
		expect(labels.sources.size).toBe(0)
		expect(onError).toHaveBeenCalledWith('1.2.4', expect.objectContaining({ message: 'Request timed out' }))
		// Nothing asked for a signal without a labels node
		expect(client.getDirectory).toHaveBeenCalledTimes(2)
	})

	// A config saved while disconnected loads the matrix from the tree it has, but no label request is sent
	it('keeps the label a signal had when its request fails', async () => {
		const matrix = info((m) => {
			m.targets = new Map([
				[1, { labelsLocation: '1.2.1' }],
				[2, { labelsLocation: '1.2.2' }],
			])
		})
		const client = {
			getDirectory: vi.fn(async () => ({ sentOk: false, response: undefined })),
		}
		const previous = emptyLabels()
		previous.targets.set(1, new Map([[0, 'Studio A']]))
		const labels = await readSignalLabels(client as never, matrix.node!, () => undefined, previous)
		expect(firstLabels(labels, 'target')).toEqual(new Map([[1, 'Studio A']]))
	})

	// The provider reports the change to a label node once asked for it, before the other signals' replies are in
	it('keeps a change reported while the labels are read, which goes into what they are read into', async () => {
		const matrix = info((m) => {
			m.targets = new Map([
				[1, { labelsLocation: '1.2.1' }],
				[2, { labelsLocation: '1.2.2' }],
			])
		})
		let release!: () => void
		const held = new Promise<void>((resolve) => (release = resolve))
		const reply = (value: string) =>
			new NumberedTreeNodeImpl(
				1,
				new EmberNodeImpl('labels'),
				EmberModel.childrenOf([
					new NumberedTreeNodeImpl(1, new ParameterImpl(ParameterType.String, 'a', undefined, value)),
				]),
			)
		const client = {
			getDirectory: vi.fn(async (node: { path: string }) => ({
				sentOk: true,
				// Target 2's reply is held until target 1's label has changed again
				response: node.path === '1.2.1' ? Promise.resolve(reply('Mon')) : held.then(() => reply('Booth')),
			})),
		}
		const into = emptyLabels()
		const reading = readSignalLabels(client as never, matrix.node!, () => undefined, undefined, into)
		await vi.waitFor(() => expect(into.targets.get(1)).toBeDefined())
		into.targets.set(1, new Map([[1, 'Studio A']]))
		release()
		const labels = await reading
		expect(labels).toBe(into)
		expect(firstLabels(labels, 'target')).toEqual(
			new Map([
				[1, 'Studio A'],
				[2, 'Booth'],
			]),
		)
	})

	it('reads nothing for a matrix without labels', async () => {
		const client = { getMatrixLabels: vi.fn(), getDirectory: vi.fn() }
		const labels = await readSignalLabels(client as never, info().node!)
		expect(labels).toEqual(emptyLabels())
		expect(client.getMatrixLabels).not.toHaveBeenCalled()
		expect(client.getDirectory).not.toHaveBeenCalled()
	})
})

describe('applyLabelChanges', () => {
	const { Added, Updated, OutsideTree } = TreeChangeKind
	const primary = new EmberModel.LabelImpl('1.9', 'Primary')
	const short = new EmberModel.LabelImpl('1.8', 'Short')

	/** A loaded matrix with two label sets, each signal's labels as read */
	function withSets() {
		const loaded = info((m) => (m.labels = [primary, short]))
		loaded.labels.targets.set(
			1,
			new Map([
				[0, 'Studio A'],
				[1, 'A'],
			]),
		)
		loaded.labels.targets.set(2, new Map([[1, 'B']]))
		return loaded
	}

	/** A change to a label, as the library reports it: the parameter, and whose label it is */
	function labelChange(
		of: MatrixInfo,
		path: EmberTypes.RelativeOID,
		label: { kind: 'target' | 'source'; signal: number; set?: EmberModel.Label; text?: string },
		kind: TreeChangeKind = Updated,
	): TreeChange {
		const element = new NumberedTreeNodeImpl(
			Number(path.split('.').at(-1)),
			new ParameterImpl(ParameterType.String, 'label', undefined, label.text),
		)
		const whose: SignalLabel = { matrix: of.node as never, matrixPath: '1.4', ...label }
		if (kind === OutsideTree) return { kind, path, element: element as never, label: whose }
		if (kind === Added) return { kind, path, element, label: whose }
		return { kind, path, element, changed: ['value'], previous: {}, label: whose }
	}

	it("replaces a signal's label from the first label set that has one", () => {
		const loaded = withSets()
		const { relabelled } = applyLabelChanges(
			[loaded],
			[labelChange(loaded, '1.9.1.1', { kind: 'target', signal: 1, set: primary, text: 'Studio B' })],
		)
		expect(relabelled).toEqual(new Set([loaded]))
		expect(signalLabel(loaded, 'target', 1)).toBe('Studio B')
	})

	// Kept, should the earlier set's label go
	it("keeps a later set's label without it becoming the signal's label", () => {
		const loaded = withSets()
		applyLabelChanges([loaded], [labelChange(loaded, '1.8.1.1', { kind: 'target', signal: 1, set: short, text: 'Z' })])
		expect(signalLabel(loaded, 'target', 1)).toBe('Studio A')
		expect(loaded.labels.targets.get(1)?.get(1)).toBe('Z')
	})

	it('names a signal from a later set while no earlier one has a label for it', () => {
		const loaded = withSets()
		applyLabelChanges(
			[loaded],
			[labelChange(loaded, '1.8.1.2', { kind: 'target', signal: 2, set: short, text: 'Booth' })],
		)
		expect(signalLabel(loaded, 'target', 2)).toBe('Booth')
	})

	// The labels getMatrixLabels fetches come as added, and those whose node the tree hasn't loaded as outside it
	it('takes labels however the library reports them: added, updated or outside the tree', () => {
		const loaded = withSets()
		applyLabelChanges(
			[loaded],
			[
				labelChange(loaded, '1.9.2.3', { kind: 'source', signal: 3, set: primary, text: 'Mic 3' }, Added),
				labelChange(loaded, '1.9.2.4', { kind: 'source', signal: 4, set: primary, text: 'Mic 4' }, OutsideTree),
			],
		)
		expect(signalLabel(loaded, 'source', 3)).toBe('Mic 3')
		expect(signalLabel(loaded, 'source', 4)).toBe('Mic 4')
	})

	it("follows the first label in a signal's labels node, by the parameter's number", () => {
		const loaded = info((m) => (m.targets = new Map([[1, { labelsLocation: '1.2.1' }]])))
		loaded.labels.targets.set(
			1,
			new Map([
				[2, 'Mon'],
				[5, 'Long'],
			]),
		)
		applyLabelChanges([loaded], [labelChange(loaded, '1.2.1.5', { kind: 'target', signal: 1, text: 'Longer' })])
		expect(signalLabel(loaded, 'target', 1)).toBe('Mon')
		applyLabelChanges([loaded], [labelChange(loaded, '1.2.1.2', { kind: 'target', signal: 1, text: 'Monitor' })])
		expect(signalLabel(loaded, 'target', 1)).toBe('Monitor')
		// No longer a string: the next label names the signal
		applyLabelChanges([loaded], [labelChange(loaded, '1.2.1.2', { kind: 'target', signal: 1 })])
		expect(signalLabel(loaded, 'target', 1)).toBe('Longer')
	})

	it("leaves another matrix's labels alone", () => {
		const loaded = withSets()
		const other = withSets()
		const { relabelled } = applyLabelChanges(
			[loaded],
			[labelChange(other, '1.9.1.1', { kind: 'target', signal: 1, set: primary, text: 'Elsewhere' })],
		)
		expect(relabelled.size).toBe(0)
		expect(signalLabel(loaded, 'target', 1)).toBe('Studio A')
	})

	// Two paths configured for the one matrix, by number and by identifiers
	it('relabels every configured path that is the matrix', () => {
		const loaded = withSets()
		const byName: MatrixInfo = { ...loaded, path: 'device.router', key: 'device_router', labels: emptyLabels() }
		applyLabelChanges(
			[loaded, byName],
			[labelChange(loaded, '1.9.1.1', { kind: 'target', signal: 1, set: primary, text: 'Studio B' })],
		)
		expect(signalLabel(byName, 'target', 1)).toBe('Studio B')
	})

	it('puts a change into the labels being read as well', () => {
		const loaded = withSets()
		loaded.labelsBeingRead = emptyLabels()
		applyLabelChanges(
			[loaded],
			[labelChange(loaded, '1.9.1.1', { kind: 'target', signal: 1, set: primary, text: 'Studio B' })],
		)
		expect(loaded.labelsBeingRead.targets.get(1)).toEqual(new Map([[0, 'Studio B']]))
	})

	it('reads the labels again once the matrix has new label sets, or labels nodes', () => {
		const loaded = info((m) => (m.targets = new Map([[1, { identifier: 'Out 1' }]])))
		const node = loaded.node!
		const updated = (changed: ContentsProperty[], previous: object): TreeChange => ({
			kind: Updated,
			path: '1.4',
			element: node as never,
			changed,
			previous,
		})
		expect(applyLabelChanges([loaded], [updated(['labels'], { labels: undefined })]).reread).toEqual(new Set([loaded]))
		node.contents.targets = new Map([[1, { identifier: 'Out 1', labelsLocation: '1.2.1' }]])
		expect(
			applyLabelChanges([loaded], [updated(['targets'], { targets: new Map([[1, { identifier: 'Out 1' }]]) })]).reread
				.size,
		).toBe(1)
		// A signal renamed, or gone offline: its labels are where they were
		expect(
			applyLabelChanges(
				[loaded],
				[updated(['targets'], { targets: new Map([[1, { identifier: 'Old', labelsLocation: '1.2.1' }]]) })],
			).reread.size,
		).toBe(0)
	})
})

describe('signalProperty', () => {
	// N:N, so a target's connected sources are a list
	const router = info((m) => {
		m.matrixType = EmberModel.MatrixType.NToN
		m.addressingMode = MatrixAddressingMode.NonLinear
		m.targets = new Map([
			[1, { identifier: 'Out 1', isOnline: false, labelsLocation: '1.2.1' }],
			[2, {}],
			[3, {}],
		])
		m.sources = new Map([
			[1, { identifier: 'In 1' }],
			[2, {}],
		])
		m.connections = EmberModel.connectionsOf([
			{ target: 1, sources: [2, 1], disposition: EmberModel.ConnectionDisposition.Locked },
			{ target: 2 },
		])
	})
	router.labels.targets.set(1, new Map([[0, 'Studio A']]))

	it.each([
		['target', 1, 'label', 'Studio A'],
		['target', 2, 'label', null],
		['source', 1, 'label', 'In 1'],
		['target', 1, 'identifier', 'Out 1'],
		['target', 2, 'identifier', null],
		['target', 1, 'isOnline', false],
		// The DTD's default
		['target', 2, 'isOnline', true],
		['target', 1, 'labelsLocation', '1.2.1'],
		['target', 1, 'connections', [1, 2]],
		['target', 2, 'connections', []],
		// None reported for it
		['target', 3, 'connections', []],
		['target', 1, 'disposition', 'locked'],
		// The DTD's default
		['target', 2, 'disposition', 'tally'],
		['target', 3, 'disposition', null],
		// A signal the matrix doesn't have
		['target', 9, 'label', null],
		['source', 9, 'isOnline', null],
	] as const)("gives %s %i's %s as %j", (kind, signal, property, expected) => {
		expect(signalProperty(router, kind, signal, property)).toEqual(expected)
	})

	// A target holds one source at most: a number, or null for none
	it.each([
		['1:N', EmberModel.MatrixType.OneToN],
		['1:1', EmberModel.MatrixType.OneToOne],
		['no type (1:N)', undefined],
	])("gives a %s matrix's connected source as a number", (_name, matrixType) => {
		const matrix = info((m) => {
			m.matrixType = matrixType
			m.targets = new Map([
				[1, {}],
				[2, {}],
			])
			m.connections = EmberModel.connectionsOf([{ target: 1, sources: [4] }, { target: 2 }])
		})
		expect(signalProperty(matrix, 'target', 1, 'connections')).toBe(4)
		expect(signalProperty(matrix, 'target', 2, 'connections')).toBeNull()
	})

	it('gives no connections until they are loaded', () => {
		const matrix = info((m) => (m.targets = new Map([[1, {}]])))
		expect(signalProperty(matrix, 'target', 1, 'connections')).toBeNull()
		expect(signalProperty(matrix, 'target', 1, 'disposition')).toBeNull()
	})

	// A report on another target, or a connect's reply, creates the library's connections before the GetDirectory on the
	// matrix has loaded them all: a target missing from them may have a source
	it('gives no connections while it has only those a report covered', () => {
		const matrix = info((m) => {
			m.targets = new Map([
				[1, {}],
				[2, {}],
			])
			m.connections = EmberModel.connectionsOf([{ target: 2, sources: [5] }])
		})
		matrix.connectionsLoaded = false
		expect(signalProperty(matrix, 'target', 1, 'connections')).toBeNull()
		expect(signalProperty(matrix, 'target', 2, 'disposition')).toBeNull()
	})

	it('gives nothing for a matrix not loaded', () => {
		expect(signalProperty({ path: '1.4', key: '1_4', labels: emptyLabels() }, 'target', 1, 'isOnline')).toBeNull()
	})
})
