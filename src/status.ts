import { InstanceBase, InstanceStatus } from '@companion-module/base'
import type { EmberPlusConfig as ModuleConfig } from './config.js'

export interface Status {
	status: InstanceStatus
	message: string | object | null
}

/**
 * Status Manager Utility
 * Only calls update Status if status has actually changed, with a configurable debounce
 * @param self InstanceBase from which to call updateStatus
 * @param initStatus Status to be set on init
 * @param debounceTimeout Debounce interval in mS to be applied after a status update
 *
 */

export class StatusManager {
	#currentStatus: Status = { status: InstanceStatus.Disconnected, message: '' }
	#newStatus: Status = { status: InstanceStatus.Disconnected, message: '' }
	#parentInstance!: InstanceBase<ModuleConfig>
	private debounceTimer: NodeJS.Timeout | undefined
	#debounceTimeout: number = 1000
	#isDestroyed: boolean = false

	constructor(
		self: InstanceBase<ModuleConfig>,
		initStatus: Status = { status: InstanceStatus.Disconnected, message: null },
		debounceTimeout: number = 1000,
	) {
		this.#parentInstance = self
		this.setNewStatus(initStatus)
		this.#debounceTimeout = debounceTimeout
	}

	/**
	 * @returns Current status
	 *
	 */

	public get status(): Status {
		return this.#currentStatus
	}

	public get isDestroyed(): boolean {
		return this.#isDestroyed
	}

	/**
	 * Updates status if changed after debounce interval
	 * @param newStatus Status & Message
	 *
	 */

	public updateStatus(newStatus: InstanceStatus, newMsg: string | object | null = null): void {
		if (this.#isDestroyed) {
			console.log(
				`Module destroyed. Can't update status\n${newStatus}: ${typeof newMsg == 'object' ? JSON.stringify(newMsg) : newMsg}`,
			)
			return
		}
		if (this.#currentStatus.status === newStatus && this.#currentStatus.message === newMsg) return
		this.#newStatus = { status: newStatus, message: newMsg }
		if (this.debounceTimer) {
			return
		}
		this.debounceTimer = setTimeout(() => this.setNewStatus(this.#newStatus), this.#debounceTimeout)
	}

	/**
	 * Perform the status update
	 * @param newStatus
	 *
	 */

	private setNewStatus(newStatus: Status = this.#newStatus): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			delete this.debounceTimer
		}
		if (typeof newStatus.message === 'object') {
			this.#parentInstance.updateStatus(newStatus.status, JSON.stringify(newStatus.message))
		} else {
			this.#parentInstance.updateStatus(newStatus.status, newStatus.message)
		}
		this.#currentStatus = newStatus
	}

	/**
	 * Clears any running debounce timer, sets status to disconnected
	 *
	 */

	public destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			delete this.debounceTimer
		}
		this.setNewStatus({ status: InstanceStatus.Disconnected, message: 'Destroyed' })
		this.#isDestroyed = true
	}
}
