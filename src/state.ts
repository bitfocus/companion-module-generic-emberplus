import type { Model as EmberModel } from 'emberplus-connection'
import { type TreeElement, type EmberElement, ElementType } from 'emberplus-connection/dist/model'

export interface CurrentSelected {
	target: number
	source: number
	matrix: number
}

interface feedbacks {
	byId: Map<string, string>
	byPath: Map<string, string[]>
}

export class EmberPlusState {
	selected: CurrentSelected
	parameters: Map<string, EmberModel.Parameter> = new Map<string, EmberModel.Parameter>()
	private feedbacks: feedbacks = {
		byId: new Map<string, string>(),
		byPath: new Map<string, string[]>(),
	}
	emberElement: Map<string, TreeElement<EmberElement>> = new Map<string, TreeElement<EmberElement>>()

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

	public addIdtoPathMap = (id: string, path: string): void => {
		this.updatePathOnIdMap(id, path)
		if (path === '') return
		const fbIds = this.feedbacks.byPath.get(path) ?? []
		if (fbIds.includes(id)) return
		this.feedbacks.byPath.set(path, [...fbIds, id])
	}

	/**
	 * Update feedbacks.byId Map to note which ember path a Feedback ID is using
	 * @param id Feedback ID
	 * @param path Ember Path
	 */

	private updatePathOnIdMap = (id: string, path: string): void => {
		if (this.feedbacks.byId.has(id)) {
			const oldPath = this.feedbacks.byId.get(id) ?? ''
			if (oldPath === path) return
			const oldIdArray = this.feedbacks.byPath.get(oldPath)
			if (oldIdArray !== undefined && oldIdArray.indexOf(id) >= 0) {
				oldIdArray.splice(oldIdArray.indexOf(id), 1)
				this.feedbacks.byPath.set(oldPath, oldIdArray)
			}
		}
		this.feedbacks.byId.set(id, path)
	}

	/**
	 * Get IDs of Feedbacks using Ember path
	 * @param path Ember Path
	 * @returns Array of Feedback IDs
	 */

	public getFeedbacksByPath(path: string): string[] {
		return this.feedbacks.byPath.get(path) ?? []
	}

	/**
	 * Add or merge node data to this.state.parameters Map
	 * @param path Ember Path
	 * @param node Ember element
	 */
	public updateParameterMap(path: string, node: TreeElement<EmberElement>): void {
		if (node.contents.type !== ElementType.Parameter) return
		if (this.parameters.has(path)) {
			this.parameters.set(path, {
				...this.parameters.get(path),
				...node.contents,
			})
		} else {
			this.parameters.set(path, node.contents)
		}
		this.emberElement.set(path, node)
	}

	/**
	 * Returns the current enumeration string of the parameter
	 */

	public getCurrentEnumValue(path: string): string {
		return this.parameters.get(path)?.enumeration?.split('\n')[Number(this.parameters.get(path)?.value)] ?? ''
	}

	/**
	 * Returns the index value of enum string
	 */

	public getEnumIndex(path: string, enumStr: string): number | undefined {
		return this.parameters.get(path)?.enumeration?.split('\n').indexOf(enumStr)
	}
}
