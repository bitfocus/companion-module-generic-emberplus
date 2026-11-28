import { Model as EmberModel } from '@phillipivan/emberplus-connection'
import { enumEntryName, enumEntryValue } from './enums.js'
import { emptyLabels, matrixOptionKey, type MatrixInfo } from './matrices.js'

const { ElementType } = EmberModel
type TreeElement<T extends EmberModel.EmberElement> = EmberModel.TreeElement<T>
type EmberElement = EmberModel.EmberElement

/** The XY selection: a target and a source of a matrix, by its configured path. -1, and '' for the matrix, for none */
export interface CurrentSelected {
	target: number
	source: number
	matrix: string
}

/** No selection */
function noSelection(): CurrentSelected {
	return { source: -1, target: -1, matrix: '' }
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
	/**
	 * Each registered parameter's tree element, as last registered or reported, which its presets are named and checked
	 * by. Unlike the element cache, which a config change clears and a stream's unsubscribing trims so that the next use
	 * registers afresh, it is kept until the provider is changed
	 */
	public parameterElements: Map<string, TreeElement<EmberElement>> = new Map()
	public monitoredParameters: Set<string> = new Set()
	/** The matrices in the module config, by path, in the order given, less any the provider showed not to be one */
	public matrices: Map<string, MatrixInfo> = new Map()
	/** The configured matrices left out as the provider showed them not to be one, and why, until they are looked for again */
	public droppedMatrices: Map<string, string> = new Map()
	private feedbacks: Feedbacks = {
		byId: new Map(),
		byPath: new Map(),
	}
	/** The parameter feedbacks that don't read their parameter's value, which a new value alone doesn't recheck */
	private notReadingValue: Set<string> = new Set()
	/** The Matrix Property feedbacks, by the matrix they read, so that a change to a matrix rechecks only its own */
	private matrixFeedbacks: Feedbacks = {
		byId: new Map(),
		byPath: new Map(),
	}

	constructor() {
		this.selected = noSelection()
	}

	/**
	 * Set the matrices from the module config. A matrix still configured keeps what was learnt of it until it is loaded
	 * again, so its fields keep their choices meanwhile.
	 */
	public setMatrixPaths(paths: readonly string[]): void {
		const previous = this.matrices
		this.droppedMatrices.clear()
		this.matrices = new Map(
			paths.map((path) => {
				// A read under way fills the info it started on, not this one
				const { labelsBeingRead: _reading, ...kept } = previous.get(path) ?? { labels: emptyLabels() }
				return [path, { ...kept, path, key: matrixOptionKey(path) }]
			}),
		)
	}

	/** Leave out a configured matrix the provider showed not to be one, saying why, until it is looked for again */
	public dropMatrix(path: string, reason: string): void {
		this.matrices.delete(path)
		this.droppedMatrices.set(path, reason)
	}

	/** A feedback reads a matrix: recheck it when the matrix changes. A feedback edited onto another leaves the one it read */
	public addMatrixFeedback(id: string, path: string): void {
		this.removeMatrixFeedback(id)
		this.matrixFeedbacks.byId.set(id, path)
		const ids = this.matrixFeedbacks.byPath.get(path) ?? new Set<string>()
		ids.add(id)
		this.matrixFeedbacks.byPath.set(path, ids)
	}

	/** A Matrix Property feedback is removed or disabled */
	public removeMatrixFeedback(id: string): void {
		const path = this.matrixFeedbacks.byId.get(id)
		if (path === undefined) return
		this.matrixFeedbacks.byId.delete(id)
		const ids = this.matrixFeedbacks.byPath.get(path)
		ids?.delete(id)
		if (ids?.size === 0) this.matrixFeedbacks.byPath.delete(path)
	}

	/** The feedbacks reading a matrix */
	public getMatrixFeedbacks(path: string): Set<string> {
		return this.matrixFeedbacks.byPath.get(path) ?? new Set()
	}

	/**
	 * Register feedback ID against an ember path
	 * @param id Feedback ID
	 * @param path Ember Path
	 */
	public addIdToPathMap(id: string, path: string, readsValue = true): void {
		this.updatePathOnIdMap(id, path)
		if (readsValue) this.notReadingValue.delete(id)
		else this.notReadingValue.add(id)

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

	/** Whether a feedback reads its parameter's value, so that a new value rechecks it (see addIdToPathMap) */
	public feedbackReadsValue(id: string): boolean {
		return !this.notReadingValue.has(id)
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
		this.notReadingValue.delete(id)
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
		this.parameterElements.set(path, node)
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

	/** Forget a parameter or function: one discovery found, and a later discovery didn't */
	public forgetElement(path: string): void {
		this.parameters.delete(path)
		this.functions.delete(path)
		this.emberElement.delete(path)
		this.parameterElements.delete(path)
		this.monitoredParameters.delete(path)
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
	 * Clear what was learnt from the provider, for another. The matrices stay configured, without what was learnt of them,
	 * and the Matrix Property feedbacks stay registered against them: the feedbacks are still on their buttons.
	 */
	public clear(): void {
		this.parameters.clear()
		this.functions.clear()
		this.emberElement.clear()
		this.parameterElements.clear()
		this.droppedMatrices.clear()
		this.feedbacks.byId.clear()
		this.feedbacks.byPath.clear()
		this.notReadingValue.clear()
		for (const info of this.matrices.values()) {
			info.node = undefined
			info.connectionsLoaded = false
			info.labels = emptyLabels()
			info.labelsBeingRead = undefined
		}
		this.selected = noSelection()
	}

	/** Clear the XY selection */
	public clearSelection(): void {
		this.selected = noSelection()
	}
}
