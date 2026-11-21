import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { enumEntryName, enumEntryValue } from './enums.js'

const { ElementType } = EmberModel
type TreeElement<T extends EmberModel.EmberElement> = EmberModel.TreeElement<T>
type EmberElement = EmberModel.EmberElement

export interface CurrentSelected {
	target: number
	source: number
	matrix: number
}

interface Feedbacks {
	byId: Map<string, string>
	byPath: Map<string, Set<string>>
}

export class EmberPlusState {
	public selected: CurrentSelected
	public parameters: Map<string, EmberModel.Parameter> = new Map()
	public functions: Map<string, EmberModel.EmberFunction> = new Map()
	public emberElement: Map<string, TreeElement<EmberElement>> = new Map()
	public monitoredParameters: Set<string> = new Set()
	public matrices: string[] = []
	private feedbacks: Feedbacks = {
		byId: new Map(),
		byPath: new Map(),
	}

	constructor() {
		this.selected = {
			source: -1,
			target: -1,
			matrix: -1,
		}
	}

	/**
	 * Register feedback ID against an ember path
	 * @param id Feedback ID
	 * @param path Ember Path
	 */
	public addIdToPathMap(id: string, path: string): void {
		this.updatePathOnIdMap(id, path)

		if (path === '') return

		const fbIds = this.feedbacks.byPath.get(path) ?? new Set<string>()
		if (fbIds.has(id)) return

		fbIds.add(id)
		this.feedbacks.byPath.set(path, fbIds)
	}

	/**
	 * Update feedbacks.byId Map to note which ember path a Feedback ID is using
	 * @param id Feedback ID
	 * @param path Ember Path
	 */
	private updatePathOnIdMap(id: string, path: string): void {
		const oldPath = this.feedbacks.byId.get(id)

		// If already mapped to same path, no work needed
		if (oldPath === path) return

		// Remove from old path's set if it exists
		if (oldPath !== undefined) {
			const oldIdSet = this.feedbacks.byPath.get(oldPath)
			if (oldIdSet?.has(id)) {
				oldIdSet.delete(id)
				// Clean up empty sets
				if (oldIdSet.size === 0) {
					this.feedbacks.byPath.delete(oldPath)
				}
			}
		}

		this.feedbacks.byId.set(id, path)
	}

	/**
	 * The path a feedback reads, if it is registered against one
	 * @param id Feedback ID
	 */
	public feedbackPath(id: string): string | undefined {
		const path = this.feedbacks.byId.get(id)
		return path === '' ? undefined : path
	}

	/** The paths feedbacks read */
	public feedbackPaths(): string[] {
		return [...this.feedbacks.byPath.keys()]
	}

	/**
	 * Get IDs of Feedbacks using Ember path
	 * @param path Ember Path
	 * @returns Set of Feedback IDs
	 */
	public getFeedbacksByPath(path: string): Set<string> {
		return this.feedbacks.byPath.get(path) ?? new Set()
	}

	/**
	 * Remove a feedback ID from all tracking
	 * @param id Feedback ID to remove
	 */
	public removeFeedbackId(id: string): void {
		const path = this.feedbacks.byId.get(id)
		if (path !== undefined) {
			const fbIds = this.feedbacks.byPath.get(path)
			if (fbIds) {
				fbIds.delete(id)
				if (fbIds.size === 0) {
					this.feedbacks.byPath.delete(path)
				}
			}
		}
		this.feedbacks.byId.delete(id)
	}

	/**
	 * Add or merge node data to parameters Map
	 * @param path Ember Path
	 * @param node Ember element
	 */
	public updateParameterMap(path: string, node: TreeElement<EmberElement>): void {
		if (node.contents.type !== ElementType.Parameter) return

		// A report may carry only what changed, so merge it into what is known. A merge whose value doesn't fit the type
		// it ends with (a report of another type) is a parameter of no type, so the report replaces what was known.
		const existing = this.parameters.get(path)
		const merged = { ...existing, ...node.contents }
		this.parameters.set(path, EmberModel.fitsItsType(merged) ? merged : node.contents)
		this.emberElement.set(path, node)
	}

	/**
	 * Add or merge function node data to functions Map
	 * @param path Ember Path
	 * @param node Ember element
	 */
	public updateFunctionMap(path: string, node: TreeElement<EmberElement>): void {
		if (node.contents.type !== ElementType.Function) return

		const existing = this.functions.get(path)
		this.functions.set(path, existing ? { ...existing, ...node.contents } : node.contents)
		this.emberElement.set(path, node)
	}

	/**
	 * The name of the parameter's current entry, from its enumMap or else its enumeration, as the device names it (a
	 * hidden entry with its "~"; see enums.ts).
	 * @param path Ember Path
	 * @returns The entry's name, or an empty string for a value with no entry, or none at present (null)
	 */
	public getCurrentEnumValue(path: string): string {
		const param = this.parameters.get(path)
		if (!param || param.value === undefined || param.value === null) return ''
		return enumEntryName(param) ?? ''
	}

	/**
	 * The value of the parameter's entry of a name, from its enumMap or else its enumeration: the entry's number in the
	 * map, or its place in the enumeration. A name beginning with "~" matches with it or without it.
	 * @param path Ember Path
	 * @param name The entry's name
	 * @returns The entry's value, or undefined for a name with no entry
	 */
	public getEnumValue(path: string, name: string): number | undefined {
		const param = this.parameters.get(path)
		if (!param) return undefined
		return enumEntryValue(param, name)
	}

	/**
	 * Get parameter by path
	 * @param path Ember Path
	 * @returns Parameter or undefined
	 */
	public getParameter(path: string): EmberModel.Parameter | undefined {
		return this.parameters.get(path)
	}

	/**
	 * Check if parameter exists
	 * @param path Ember Path
	 */
	public hasParameter(path: string): boolean {
		return this.parameters.has(path)
	}

	/**
	 * Clear cached ember elements
	 */
	public clearCache(): void {
		this.emberElement.clear()
	}

	/**
	 * Get function by path
	 * @param path Ember Path
	 * @returns EmberFunction or undefined
	 */
	public getFunction(path: string): EmberModel.EmberFunction | undefined {
		return this.functions.get(path)
	}

	/**
	 * Check if function exists
	 * @param path Ember Path
	 */
	public hasFunction(path: string): boolean {
		return this.functions.has(path)
	}

	/**
	 * Clear all state
	 */
	public clear(): void {
		this.parameters.clear()
		this.functions.clear()
		this.emberElement.clear()
		this.feedbacks.byId.clear()
		this.feedbacks.byPath.clear()
		this.selected = { source: -1, target: -1, matrix: -1 }
	}
}
