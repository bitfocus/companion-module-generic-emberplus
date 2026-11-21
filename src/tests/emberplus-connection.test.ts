import { describe, it, expect, afterEach } from 'vitest'
import {
	berEncode,
	berDecode,
	EmberClient,
	Model as EmberModel,
	Types as EmberTypes,
} from '@phillipivan/emberplus-connection'
import { ActionId } from '../actions.js'
import { setValue } from '../actions/parameter.js'

const { ConnectionImpl, LabelImpl } = EmberModel

// Regression tests for library bugs the module met on emberplus-connection 0.3.1, which it carried a yarn patch for
// (the matrix decoding and connection updates) or worked around (the last block, in src/actions/parameter.ts). All
// three are fixed in @phillipivan/emberplus-connection 0.5.0, which the module now depends on, without a patch.

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

/** A matrix's connections are a Map by target */
function targetsOf(matrixConnections: EmberModel.Connections | undefined): number[] {
	return [...(matrixConnections?.keys() ?? [])]
}

const connections: EmberModel.Connections = EmberModel.connectionsOf([
	new ConnectionImpl(0, [1]),
	new ConnectionImpl(1, [2]),
	new ConnectionImpl(2, [0]),
	new ConnectionImpl(3, [3]),
])

const matrix = new EmberModel.MatrixImpl(
	'router',
	EmberModel.signalsOf([0, 1, 2, 3]), // targets
	EmberModel.signalsOf([0, 1, 2, 3]), // sources
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
		expect(targetsOf(decoded.connections)).toEqual([0, 1, 2, 3])
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
		expect(targetsOf(decoded.connections)).toEqual([0, 1, 2, 3])
		expect(decoded.connections?.get(1)?.sources).toEqual([2])
		expect(decoded.connections?.get(3)?.sources).toEqual([3])
	})

	it('decodes a whole matrix in the indefinite length form', () => {
		const decoded = decodeMatrix(indefinite)
		expect(decoded.matrixType).toBe(EmberModel.MatrixType.OneToN)
		expect(decoded.addressingMode).toBe(EmberModel.MatrixAddressingMode.NonLinear)
		expect(decoded.labels).toEqual(matrix.labels)
		expect(decoded.targets).toEqual(matrix.targets)
		expect(decoded.sources).toEqual(matrix.sources)
		expect(targetsOf(decoded.connections)).toEqual([0, 1, 2, 3])
	})
})

/** Deliver elements the way the socket does: encoded, decoded, then emitted as an emberTree. */
function receive(target: EmberClient, element: EmberTypes.RootElement): void {
	const tree = berDecode(berEncode([element], EmberTypes.RootType.Elements))
	// The socket emits each message it decodes (S101Socket's emberTree), and the client listens on its _client
	const socket = (target as unknown as { _client: { emit(event: 'emberTree', tree: unknown): boolean } })._client
	socket.emit('emberTree', tree)
}

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

	function matrixAt(path: EmberTypes.RelativeOID, matrixConnections: EmberModel.Connections) {
		return new EmberModel.QualifiedElementImpl(
			path,
			new EmberModel.MatrixImpl('matrix', undefined, undefined, matrixConnections),
		)
	}

	it('keeps unchanged crosspoints when the device reports one change', async () => {
		client = new EmberClient('127.0.0.1')
		receive(client, new EmberModel.QualifiedElementImpl('1', new EmberModel.EmberNodeImpl('router')))
		receive(client, matrixAt('1.1', connections))

		// What the client's tree holds once the report is in, as the callback is given a report's own element
		const node = await client.getElementByPath('1.1')
		const stored = () => (node?.contents as EmberModel.Matrix).connections

		// target 1 now takes source 3
		receive(client, matrixAt('1.1', EmberModel.connectionsOf([new ConnectionImpl(1, [3])])))

		expect(targetsOf(stored())).toEqual([0, 1, 2, 3])
		expect(stored()?.get(0)?.sources).toEqual([1])
		expect(stored()?.get(1)?.sources).toEqual([3])
		expect(stored()?.get(3)?.sources).toEqual([3])
	})
})

// A Lawo Powercore would not take SDP writes from the module (#43). EmberClient.setValue
// sent the node it was handed, and the module handed it the cached one, so every property
// the provider had reported went back with the value. The library encoded minimum/maximum
// by the parameter's type, which on a String parameter turned a numeric maximum into a
// UTF8String; Glow's MinMax only allows integer, real or null. The module worked around it
// until library 0.5.0, whose setValue sends only the path and the value.
describe('set value string requests', () => {
	let client: EmberClient | undefined

	afterEach(() => {
		client?.discard()
		client = undefined
	})

	// The SDP from #43, taken from a Powercore's Ember+ tree. The parameter's maximum is
	// not captured: the reporters have not said whether the Powercore sets one.
	const sdpLines = [
		'v=0',
		'o=- 09420142300001 0 IN IP4 192.168.99.240',
		's=core01:rav01',
		't=0 0',
		'a=clock-domain:PTPv2 0',
		'a=ts-refclk:ptp=IEEE1588-2008:00-0B-72-FF-FE-09-88-F6:0',
		'a=mediaclk:direct=0',
		'a=group:DUP ra0 ra1',
		'm=audio 5004 RTP/AVP 98',
		'c=IN IP4 239.99.240.1/16',
		'a=source-filter: incl IN IP4 239.99.240.1 192.168.99.240',
		'a=rtpmap:98 L24/48000/2',
		'a=mid:ra0',
		'a=framecount:48',
		'a=recvonly',
		'a=ptime:1',
		'a=sync-time:0',
		'a=mediaclk:direct=0',
		'm=audio 5004 RTP/AVP 98',
		'c=IN IP4 239.98.240.1/16',
		'a=source-filter: incl IN IP4 239.98.240.1 192.168.98.240',
		'a=rtpmap:98 L24/48000/2',
		'a=mid:ra1',
		'a=framecount:48',
		'a=recvonly',
		'a=ptime:1',
		'a=sync-time:0',
		'a=mediaclk:direct=0',
	]

	it('sends the SDP with only path and value', async () => {
		client = new EmberClient('127.0.0.1')
		receive(client, new EmberModel.QualifiedElementImpl('1', new EmberModel.EmberNodeImpl('core')))
		receive(
			client,
			new EmberModel.QualifiedElementImpl(
				'1.1',
				new EmberModel.ParameterImpl(
					EmberModel.ParameterType.String,
					'sdp',
					'SDP',
					'',
					2048, // maximum
					undefined,
					EmberModel.ParameterAccess.ReadWrite,
				),
			),
		)

		const sent: Buffer[] = []
		const socket = (client as unknown as { _client: { sendBER(data: Buffer): boolean } })._client
		socket.sendBER = (data) => sent.push(data) > 0

		const emberClient = client
		const self = {
			registerNewParameter: async (path: string) => emberClient.getElementByPath(path),
			logger: { debug: () => undefined },
		} as unknown as Parameters<typeof setValue>[0]
		const state = { parameters: new Map() } as unknown as Parameters<typeof setValue>[4]
		const queue = { add: async (fn: () => Promise<void>) => fn() } as unknown as Parameters<typeof setValue>[5]

		const action = setValue(self, client, EmberModel.ParameterType.String, ActionId.SetValueString, state, queue)
		// identifier path and escaped line breaks, as typed into the action
		await action(
			{
				id: 'act1',
				options: { path: 'core.sdp', value: sdpLines.join('\\r\\n') + '\\r\\n', parseEscapeChars: true },
			} as unknown as Parameters<typeof action>[0],
			{} as Parameters<typeof action>[1],
		)

		// The lookup also sends a GetDirectory on the parameter; the request is the one message that carries a value
		const requests = sent
			.map((data) => (berDecode(data).value as EmberModel.QualifiedElement<EmberModel.Parameter>[])[0])
			.filter((element) => element.contents.value !== undefined)
		expect(requests).toHaveLength(1)
		const request = requests[0]
		expect(request.path).toBe('1.1')
		expect(request.contents.value).toBe(sdpLines.join('\r\n') + '\r\n')
		expect(request.contents.maximum).toBeUndefined()
		expect(request.contents.identifier).toBeUndefined()
		expect(request.contents.description).toBeUndefined()
		expect(request.contents.access).toBeUndefined()
	})
})
