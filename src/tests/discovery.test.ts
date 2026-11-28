import { describe, it, expect } from 'vitest'
import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { DiscoveryPatterns, discoverTree, type PathElement } from '../discovery.js'

const { ElementType, ParameterType } = EmberModel

/** A path of elements from `Name:number` pairs, eg `Inputs:1.Ch1:3.Gain:2`; a bare number has no identifier */
function elements(text: string): PathElement[] {
	return text.split('.').map((part) => {
		const [identifier, number] = part.includes(':') ? part.split(':') : [undefined, part]
		return identifier === undefined ? { number: Number(number) } : { number: Number(number), identifier }
	})
}

describe('DiscoveryPatterns', () => {
	const matches = (patterns: string, path: string) => DiscoveryPatterns.parse(patterns).matches(elements(path))
	const walks = (patterns: string, path: string) => DiscoveryPatterns.parse(patterns).shouldWalk(elements(path))

	it.each([
		['Inputs.*.Gain', 'Inputs:1.Ch1:3.Gain:2', true],
		['Inputs.*.Gain', 'Inputs:1.Ch1:3.Trim:2', false],
		['Inputs.*.Gain', 'Inputs:1.Ch1:3.Eq:4.Gain:2', false],
		['Inputs.**.Gain', 'Inputs:1.Ch1:3.Eq:4.Gain:2', true],
		['Inputs.**', 'Inputs:1.Ch1:3', true],
		['Mixer.Channel*.Fader', 'Mixer:2.Channel12:5.Fader:1', true],
		['Mixer.Channel*.Fader', 'Mixer:2.Aux1:5.Fader:1', false],
		['**', 'Anything:4.At:2.All:9', true],
	])('%s matches %s: %s', (patterns, path, expected) => {
		expect(matches(patterns, path)).toBe(expected)
	})

	// Each element by its number as well as its identifier, so numeric paths and mixed ones work
	it.each([
		['1.3.**', 'Inputs:1.Ch1:3.Gain:2', true],
		['1.*.2', 'Inputs:1.Ch1:3.Gain:2', true],
		['Inputs.3.Gain', 'Inputs:1.Ch1:3.Gain:2', true],
		['1.3.2', '1.3.2', true],
	])('%s matches by number %s: %s', (patterns, path, expected) => {
		expect(matches(patterns, path)).toBe(expected)
	})

	// The stagetec module compared numeric paths as text, so 1.1 took in 1.10
	it('matches element by element, never by text prefix', () => {
		expect(matches('1.1.**', '1.10.2')).toBe(false)
		expect(matches('1.1.**', '1.1.2')).toBe(true)
		expect(matches('In*', 'Main:1')).toBe(false)
	})

	it('is case-sensitive, and takes regular expression characters as they are', () => {
		expect(matches('inputs.**', 'Inputs:1.Gain:2')).toBe(false)
		expect(matches('Gain (dB)', 'Gain (dB):1')).toBe(true)
		expect(matches('Gain.dB', 'GainXdB:1')).toBe(false)
	})

	it('excludes with !, whatever the order', () => {
		const patterns = 'Mixer.**, !Mixer.*.Meters.**'
		expect(matches(patterns, 'Mixer:1.Ch1:2.Fader:1')).toBe(true)
		expect(matches(patterns, 'Mixer:1.Ch1:2.Meters:3.L:1')).toBe(false)
		expect(matches('!Mixer.*.Meters.**, Mixer.**', 'Mixer:1.Ch1:2.Meters:3.L:1')).toBe(false)
	})

	it('discovers nothing from excludes alone, or no patterns', () => {
		expect(DiscoveryPatterns.parse('!Mixer.**').isEmpty).toBe(true)
		expect(DiscoveryPatterns.parse('').isEmpty).toBe(true)
		expect(DiscoveryPatterns.parse(undefined).isEmpty).toBe(true)
		expect(DiscoveryPatterns.parse(' , ').isEmpty).toBe(true)
		expect(matches('', 'Mixer:1')).toBe(false)
	})

	it('takes / as well as ., and ignores empty patterns and spaces around them', () => {
		expect(matches(' Inputs/*/Gain , ', 'Inputs:1.Ch1:3.Gain:2')).toBe(true)
		expect(DiscoveryPatterns.parse('Inputs..Gain').isEmpty).toBe(true)
	})

	it('walks a node only while a pattern could match below it', () => {
		expect(walks('Inputs.*.Gain', 'Inputs:1')).toBe(true)
		expect(walks('Inputs.*.Gain', 'Inputs:1.Ch1:3')).toBe(true)
		// Gain would be the match itself: nothing below it can match
		expect(walks('Inputs.*.Gain', 'Inputs:1.Ch1:3.Gain:2')).toBe(false)
		expect(walks('Inputs.*.Gain', 'Outputs:2')).toBe(false)
		expect(walks('Inputs.**', 'Inputs:1.Ch1:3.Eq:4')).toBe(true)
		expect(walks('**.Gain', 'Anything:4.Deep:5')).toBe(true)
	})

	it("doesn't walk a node an exclude ending in ** takes in whole", () => {
		const patterns = 'Mixer.**, !Mixer.*.Meters.**'
		expect(walks(patterns, 'Mixer:1.Ch1:2')).toBe(true)
		expect(walks(patterns, 'Mixer:1.Ch1:2.Meters:3')).toBe(false)
		expect(walks(patterns, 'Mixer:1.Ch1:2.Meters:3.Sub:1')).toBe(false)
		// An exclude of one element doesn't stop the walk below it
		expect(walks('Mixer.**, !Mixer.*.Meters', 'Mixer:1.Ch1:2.Meters:3')).toBe(true)
	})
})

/**
 * A fake client over a tree whose nodes' children are loaded only by a GetDirectory, as a provider's are. Each node
 * is `{ id, children? }`, a parameter `{ id, parameter }`, and so on
 */
type Spec =
	| { id: string; children: Spec[]; offline?: boolean }
	| { id: string; parameter: true; stream?: boolean }
	| { id: string; fn: true }
	| { id: string; matrix: true }

function fakeClient(top: Spec[], { failing = [] as string[] } = {}) {
	const pending = new Map<EmberModel.NumberedTreeNode<EmberModel.EmberElement>, Spec[]>()
	const requests: string[] = []
	const build = (specs: Spec[], parent?: EmberModel.NumberedTreeNode<EmberModel.EmberElement>, prefix = '') =>
		new Map(
			specs.map((spec, i) => {
				const number = i + 1
				const path = prefix ? `${prefix}.${number}` : `${number}`
				let contents: EmberModel.EmberElement
				if ('children' in spec) {
					contents = new EmberModel.EmberNodeImpl(spec.id)
					if (spec.offline) contents.isOnline = false
				} else if ('parameter' in spec) {
					contents = new EmberModel.ParameterImpl(ParameterType.Integer, spec.id, undefined, 0)
					if (spec.stream) (contents as EmberModel.Parameter).streamIdentifier = 1
				} else if ('fn' in spec) {
					contents = new EmberModel.EmberFunctionImpl(spec.id)
				} else {
					contents = new EmberModel.MatrixImpl(spec.id)
				}
				const node = new EmberModel.NumberedTreeNodeImpl(number, contents)
				node.parent = parent
				;(node as unknown as { path: string }).path = path
				if ('children' in spec) pending.set(node, spec.children)
				return [number, node] as const
			}),
		)
	const tree = build(top)
	const client = {
		tree,
		getDirectory: async (node: EmberModel.NumberedTreeNode<EmberModel.EmberElement>) => {
			const path = (node as unknown as { path: string }).path
			requests.push(path)
			if (failing.includes(path)) return { sentOk: true, response: Promise.reject(new Error('timed out')) }
			const children = pending.get(node)
			if (children) node.children = build(children, node, path)
			return { sentOk: true, response: Promise.resolve(node) }
		},
	}
	return { client: client as unknown as Parameters<typeof discoverTree>[0], requests }
}

/** Inputs (1) with channels 1 and 2, each a Gain and Trim; Outputs (2) with a Level; a Recall function; a Router */
function device(): Spec[] {
	const channel = (id: string): Spec => ({
		id,
		children: [
			{ id: 'Gain', parameter: true },
			{ id: 'Trim', parameter: true },
		],
	})
	return [
		{ id: 'Inputs', children: [channel('Ch1'), channel('Ch2')] },
		{ id: 'Outputs', children: [{ id: 'Level', parameter: true }] },
		{ id: 'Recall', fn: true },
		{ id: 'Router', matrix: true },
	]
}

const limits = { nodes: 2048, parameters: 2048 }
const current = { isCurrent: () => true }

describe('discoverTree', () => {
	it('finds the parameters, functions and matrices the patterns match, with their paths', async () => {
		const { client } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('Inputs.*.Gain, Recall, Router'), limits, current)
		expect(found.parameters.map(({ path, identifierPath }) => [path, identifierPath])).toEqual([
			['1.1.1', 'Inputs.Ch1.Gain'],
			['1.2.1', 'Inputs.Ch2.Gain'],
		])
		expect(found.functions.map(({ path }) => path)).toEqual(['3'])
		expect(found.matrices.map(({ path, identifierPath }) => [path, identifierPath])).toEqual([['4', 'Router']])
		expect(found.stopped).toBeUndefined()
	})

	// Each node walked is a GetDirectory and a subscription: only those the patterns lead to
	it('walks only the nodes the patterns lead to', async () => {
		const { client, requests } = fakeClient(device())
		await discoverTree(client, DiscoveryPatterns.parse('Inputs.Ch2.**'), limits, current)
		expect(requests).toEqual(['1', '1.2'])
	})

	it("doesn't walk a node an exclude takes in whole", async () => {
		const { client, requests } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('Inputs.**, !Inputs.Ch1.**'), limits, current)
		expect(requests).toEqual(['1', '1.2'])
		expect(found.parameters.map(({ path }) => path)).toEqual(['1.2.1', '1.2.2'])
	})

	// The DTD's default is online; only one saying it is offline is left
	it("doesn't walk a node reporting itself offline", async () => {
		const top = device()
		;(top[0] as { offline?: boolean }).offline = true
		const { client, requests } = fakeClient(top)
		await discoverTree(client, DiscoveryPatterns.parse('**'), limits, current)
		expect(requests).toEqual(['2'])
	})

	it('sends nothing for a node whose children are loaded already', async () => {
		const { client, requests } = fakeClient(device())
		await discoverTree(client, DiscoveryPatterns.parse('**'), limits, current)
		requests.length = 0
		const again = await discoverTree(client, DiscoveryPatterns.parse('**'), limits, current)
		expect(requests).toEqual([])
		expect(again.parameters).toHaveLength(5)
		expect(again.nodesWalked).toBe(4)
	})

	// Breadth-first: the limit cuts the deepest level everywhere, rather than finishing one branch
	it('stops at the node limit, walking breadth-first', async () => {
		const { client, requests } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('**'), { ...limits, nodes: 3 }, current)
		expect(requests).toEqual(['1', '2', '1.1'])
		expect(found.stopped).toBe('nodes')
		expect(found.nodesWalked).toBe(3)
		// Outputs' Level, on the second level, was found; Ch2's parameters, on the third, weren't all
		expect(found.parameters.map(({ path }) => path)).toEqual(['2.1', '1.1.1', '1.1.2'])
	})

	it('stops at the parameter limit', async () => {
		const { client } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('**'), { ...limits, parameters: 2 }, current)
		expect(found.stopped).toBe('parameters')
		expect(found.parameters).toHaveLength(2)
	})

	it('goes on past a node that fails to load, and reports it', async () => {
		const { client } = fakeClient(device(), { failing: ['1.1'] })
		const failed: string[] = []
		const found = await discoverTree(client, DiscoveryPatterns.parse('**'), limits, {
			...current,
			onError: (path) => failed.push(path),
		})
		expect(failed).toEqual(['1.1'])
		expect(found.parameters.map(({ path }) => path)).toEqual(['2.1', '1.2.1', '1.2.2'])
	})

	// A host change or a newer discovery: what it found is for a client or config no longer in use
	it('stops once no longer wanted, and says so', async () => {
		const { client, requests } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('**'), limits, {
			isCurrent: () => requests.length < 1,
			concurrency: 1,
		})
		expect(found.abandoned).toBe(true)
		expect(requests).toEqual(['1'])
		expect(found.parameters).toEqual([])
	})

	it('sends nothing with no pattern that includes', async () => {
		const { client, requests } = fakeClient(device())
		const found = await discoverTree(client, DiscoveryPatterns.parse('!Inputs.**'), limits, current)
		expect(requests).toEqual([])
		expect(found.parameters).toEqual([])
	})

	it('has up to the concurrency of GetDirectories waiting at once', async () => {
		const wide: Spec[] = Array.from({ length: 10 }, (_, i) => ({
			id: `N${i}`,
			children: [{ id: 'P', parameter: true }],
		}))
		const { client } = fakeClient(wide)
		let waiting = 0
		let most = 0
		const slow = {
			tree: client.tree,
			getDirectory: async (node: EmberModel.NumberedTreeNode<EmberModel.EmberElement>) => {
				waiting++
				most = Math.max(most, waiting)
				const result = await client.getDirectory(node)
				await new Promise((resolve) => setTimeout(resolve, 5))
				waiting--
				return result
			},
		}
		const found = await discoverTree(slow, DiscoveryPatterns.parse('**'), limits, {
			...current,
			concurrency: 3,
		})
		expect(most).toBe(3)
		expect(found.parameters).toHaveLength(10)
	})

	// Discovery never invokes a function, and never subscribes to a stream: it only lists them
	it('lists stream parameters like any other', async () => {
		const { client } = fakeClient([{ id: 'Meters', children: [{ id: 'L', parameter: true, stream: true }] }])
		const found = await discoverTree(client, DiscoveryPatterns.parse('**'), limits, current)
		expect(found.parameters.map(({ path }) => path)).toEqual(['1.1'])
		expect(found.parameters[0].element.contents.type).toBe(ElementType.Parameter)
	})
})
