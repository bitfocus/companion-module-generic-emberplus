import type { Model as EmberModel } from 'emberplus-connection'
import type { TreeElement, EmberElement } from 'emberplus-connection/dist/model'

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
	feedbacks: feedbacks = {
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
}
