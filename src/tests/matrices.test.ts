import { describe, it, expect, vi } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import {
	emptyLabels,
	matrixLabel,
	matrixOptionKeys,
	matrixPaths,
	readSignalLabels,
	signalChoices,
	signalNumbers,
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

describe('matrixPaths', () => {
	it("reads the config's comma separated paths, each once, slashes as dots", () => {
		expect(matrixPaths(' 1.4, 1/5,, 1.4 ,Audio.Router ')).toEqual(['1.4', '1.5', 'Audio.Router'])
		expect(matrixPaths(undefined)).toEqual([])
	})
})

describe('matrixOptionKeys', () => {
	it("names each matrix's fields by its path, with letters and digits only", () => {
		expect(matrixOptionKeys(['1.4', 'Audio Router[1.2]'])).toEqual(
			new Map([
				['1.4', '1_4'],
				['Audio Router[1.2]', 'Audio_Router_1_2_'],
			]),
		)
	})

	it("tells apart paths that would share a key, the later by its characters' codes", () => {
		expect([...matrixOptionKeys(['1.4', '1_4', '1-4']).values()]).toEqual(['1_4', '1_005f4', '1_002d4'])
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
		matrix.labels.sources.set(2, '  Mic 2  ')
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

describe('matrixLabel', () => {
	it('names a matrix by its path, and its description or identifier once loaded', () => {
		expect(matrixLabel({ path: '1.4', key: '1_4', labels: emptyLabels() })).toBe('1.4')
		expect(matrixLabel(info())).toBe('1.4: router')
		expect(matrixLabel(info((m) => (m.description = 'Main Router')))).toBe('1.4: Main Router')
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
		expect(labels.targets).toEqual(
			new Map([
				[1, 'Studio A'],
				[2, 'B'],
			]),
		)
		expect(labels.sources).toEqual(new Map([[5, 'Five']]))
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
		expect(labels.targets).toEqual(new Map([[1, 'Third']]))
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
		previous.targets.set(1, 'Studio A')
		const labels = await readSignalLabels(client as never, matrix.node!, () => undefined, previous)
		expect(labels.targets).toEqual(new Map([[1, 'Studio A']]))
	})

	it('reads nothing for a matrix without labels', async () => {
		const client = { getMatrixLabels: vi.fn(), getDirectory: vi.fn() }
		const labels = await readSignalLabels(client as never, info().node!)
		expect(labels).toEqual(emptyLabels())
		expect(client.getMatrixLabels).not.toHaveBeenCalled()
		expect(client.getDirectory).not.toHaveBeenCalled()
	})
})

describe('signalProperty', () => {
	const router = info((m) => {
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
	router.labels.targets.set(1, 'Studio A')

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
