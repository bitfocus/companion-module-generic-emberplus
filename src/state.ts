import type { Model as EmberModel } from 'emberplus-connection'
import { type TreeElement, type EmberElement, ElementType } from 'emberplus-connection/dist/model'

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
	public emberElement: Map<string, TreeElement<EmberElement>> = new Map()
	public monitoredParameters: Set<string> = new Set()
	public matrices: Set<string> = new Set()
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

		const existing = this.parameters.get(path)
		this.parameters.set(path, existing ? { ...existing, ...node.contents } : node.contents)
		this.emberElement.set(path, node)
	}

	/**
	 * Returns the current enumeration string of the parameter
	 * @param path Ember Path
	 * @returns Current enum value string, or empty string if not found
	 */
	public getCurrentEnumValue(path: string): string {
		const param = this.parameters.get(path)
		if (!param?.enumeration || param.value === undefined) return ''

		const enumValues = param.enumeration.split('\n')
		const index = Number(param.value)

		return enumValues[index] ?? ''
	}

	/**
	 * Returns the index value of enum string
	 * @param path Ember Path
	 * @param enumStr Enum string to find
	 * @returns Index of enum string, or undefined if not found
	 */
	public getEnumIndex(path: string, enumStr: string): number | undefined {
		const enumeration = this.parameters.get(path)?.enumeration
		if (!enumeration) return undefined

		const index = enumeration.split('\n').indexOf(enumStr)
		return index === -1 ? undefined : index
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
	 * Clear all state
	 */
	public clear(): void {
		this.parameters.clear()
		this.emberElement.clear()
		this.feedbacks.byId.clear()
		this.feedbacks.byPath.clear()
		this.selected = { source: -1, target: -1, matrix: -1 }
	}
}
