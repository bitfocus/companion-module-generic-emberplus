import { describe, it, expect, afterEach } from 'vitest'
import { berEncode, berDecode, EmberClient, Model as EmberModel, Types as EmberTypes } from 'emberplus-connection'
import { ConnectionImpl } from 'emberplus-connection/dist/model/Connection.js'
import { LabelImpl } from 'emberplus-connection/dist/model/Label.js'

// These cover emberplus-connection itself, via the fixes carried in
// .yarn/patches/emberplus-connection-npm-0.3.1-*.patch. Both bugs are still
// present upstream as of 0.3.1.

/** Rewrite definite-length BER so every constructed element uses the indefinite length form. */
function toIndefiniteLength(buf: Buffer): Buffer {
	const out: Buffer[] = []
	let o = 0
	while (o < buf.length) {
		const tag = buf[o++]
		let len = buf[o++]
		if (len & 0x80) {
			const n = len & 0x7f
			len = 0
			for (let i = 0; i < n; i++) len = (len << 8) | buf[o++]
		}
		const body = buf.subarray(o, o + len)
		o += len
		if (tag & 0x20) {
			out.push(Buffer.from([tag, 0x80]), toIndefiniteLength(body), Buffer.from([0, 0]))
		} else {
			// primitives keep the definite form, as BER requires
			const lenBytes = len < 0x80 ? [len] : len < 0x100 ? [0x81, len] : [0x82, len >> 8, len & 0xff]
			out.push(Buffer.from([tag, ...lenBytes]), body)
		}
	}
	return Buffer.concat(out)
}

function encodeMatrix(matrix: EmberModel.Matrix): Buffer {
	return berEncode([new EmberModel.QualifiedElementImpl('1.1', matrix)], EmberTypes.RootType.Elements)
}

function decodeMatrix(buf: Buffer): EmberModel.Matrix {
	const root = berDecode(buf).value as EmberModel.QualifiedElement<EmberModel.Matrix>[]
	return root[0].contents
}

const connections: EmberModel.Connections = {
	0: new ConnectionImpl(0, [1]),
	1: new ConnectionImpl(1, [2]),
	2: new ConnectionImpl(2, [0]),
	3: new ConnectionImpl(3, [3]),
}

const matrix = new EmberModel.MatrixImpl(
	'router',
	[0, 1, 2, 3], // targets
	[0, 1, 2, 3], // sources
	connections,
	undefined,
	EmberModel.MatrixType.OneToN,
	EmberModel.MatrixAddressingMode.NonLinear,
	4, // targetCount
	4, // sourceCount
	undefined,
	undefined,
	undefined,
	undefined,
	[new LabelImpl('1.2.1', 'Primary'), new LabelImpl('1.2.2', 'Secondary')],
)

// BER allows any constructed element to use the indefinite length form: length
// byte 0x80, contents, then a 00 00 end-of-contents marker. The asn1 reader
// counts that marker as part of the element, so every decoder loop that runs to
// the end offset meets a 0x00 tag after its last child. The matrix labels,
// targets and sources loops demanded 0xa0 there and threw
// "Expected 0xa0: got 0x0". The connections loop consumed the marker and then
// skipped the connection after it.
//
// Synthetic: the bytes are the library's own encoding, rewritten to indefinite
// length. The fix was confirmed against the device that first showed this, but
// no capture from it yet.
describe('emberplus-connection matrix decoding', () => {
	const definite = encodeMatrix(matrix)
	const indefinite = toIndefiniteLength(definite)

	it('rewrites the fixture to indefinite length', () => {
		// root APPLICATION(0), constructed, indefinite length
		expect(indefinite.subarray(0, 2)).toEqual(Buffer.from([0x60, 0x80]))
		expect(indefinite.subarray(-2)).toEqual(Buffer.from([0, 0]))
		expect(indefinite.length).toBeGreaterThan(definite.length)
	})

	it('decodes the definite length form', () => {
		const decoded = decodeMatrix(definite)
		expect(decoded.labels).toEqual(matrix.labels)
		expect(decoded.targets).toEqual(matrix.targets)
		expect(decoded.sources).toEqual(matrix.sources)
		expect(Object.keys(decoded.connections ?? {})).toEqual(['0', '1', '2', '3'])
	})

	it('decodes labels in the indefinite length form', () => {
		const decoded = decodeMatrix(
			toIndefiniteLength(encodeMatrix({ ...matrix, targets: undefined, sources: undefined, connections: undefined })),
		)
		expect(decoded.identifier).toBe('router')
		expect(decoded.labels).toEqual(matrix.labels)
	})

	it('decodes targets in the indefinite length form', () => {
		const decoded = decodeMatrix(
			toIndefiniteLength(encodeMatrix({ ...matrix, labels: undefined, sources: undefined, connections: undefined })),
		)
		expect(decoded.targets).toEqual(matrix.targets)
	})

	it('decodes sources in the indefinite length form', () => {
		const decoded = decodeMatrix(
			toIndefiniteLength(encodeMatrix({ ...matrix, labels: undefined, targets: undefined, connections: undefined })),
		)
		expect(decoded.sources).toEqual(matrix.sources)
	})

	it('keeps every connection in the indefinite length form', () => {
		const decoded = decodeMatrix(
			toIndefiniteLength(encodeMatrix({ ...matrix, labels: undefined, targets: undefined, sources: undefined })),
		)
		expect(Object.keys(decoded.connections ?? {})).toEqual(['0', '1', '2', '3'])
		expect(decoded.connections?.[1]?.sources).toEqual([2])
		expect(decoded.connections?.[3]?.sources).toEqual([3])
	})

	it('decodes a whole matrix in the indefinite length form', () => {
		const decoded = decodeMatrix(indefinite)
		expect(decoded.matrixType).toBe(EmberModel.MatrixType.OneToN)
		expect(decoded.addressingMode).toBe(EmberModel.MatrixAddressingMode.NonLinear)
		expect(decoded.labels).toEqual(matrix.labels)
		expect(decoded.targets).toEqual(matrix.targets)
		expect(decoded.sources).toEqual(matrix.sources)
		expect(Object.keys(decoded.connections ?? {})).toEqual(['0', '1', '2', '3'])
	})
})

// A provider reports a crosspoint change by sending the matrix with only the
// changed targets in connections. EmberClient merged that into its tree after
// first overwriting the stored connections with it, so the merge ran against the
// update itself and every unchanged target was dropped from the client's copy.
describe('emberplus-connection matrix connection updates', () => {
	let client: EmberClient | undefined

	afterEach(() => {
		client?.discard()
		client = undefined
	})

	/** Deliver elements the way the socket does: encoded, decoded, then emitted as an emberTree. */
	function receive(target: EmberClient, element: EmberTypes.RootElement): void {
		const tree = berDecode(berEncode([element], EmberTypes.RootType.Elements))
		const socket = (target as unknown as { _client: { emit(event: 'emberTree', tree: unknown): boolean } })._client
		socket.emit('emberTree', tree)
	}

	function matrixAt(path: string, matrixConnections: EmberModel.Connections) {
		return new EmberModel.QualifiedElementImpl(
			path,
			new EmberModel.MatrixImpl('matrix', undefined, undefined, matrixConnections),
		)
	}

	it('keeps unchanged crosspoints when the device reports one change', async () => {
		client = new EmberClient('127.0.0.1')
		receive(client, new EmberModel.QualifiedElementImpl('1', new EmberModel.EmberNodeImpl('router')))
		receive(client, matrixAt('1.1', connections))

		const seen: EmberModel.Connections[] = []
		await client.getElementByPath('1.1', (node) => {
			seen.push(structuredClone((node.contents as EmberModel.Matrix).connections ?? {}))
		})

		// target 1 now takes source 3
		receive(client, matrixAt('1.1', { 1: new ConnectionImpl(1, [3]) }))

		expect(seen).toHaveLength(1)
		expect(Object.keys(seen[0])).toEqual(['0', '1', '2', '3'])
		expect(seen[0][0].sources).toEqual([1])
		expect(seen[0][1].sources).toEqual([3])
		expect(seen[0][3].sources).toEqual([3])
	})
})
