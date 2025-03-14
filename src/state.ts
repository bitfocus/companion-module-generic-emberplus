import type { Model as EmberModel } from 'emberplus-connection'

export interface CurrentSelected {
	target: number
	source: number
	matrix: number
}

export class EmberPlusState {
	selected: CurrentSelected
	parameters: Map<string, EmberModel.Parameter> = new Map<string, EmberModel.Parameter>()
	feedbacks: Map<string, string[]> = new Map<string, string[]>()

	constructor() {
		this.selected = {
			source: -1,
			target: -1,
			matrix: -1,
		}
	}
}
