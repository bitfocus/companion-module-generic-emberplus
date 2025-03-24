import { type DropdownChoice, InstanceBase } from '@companion-module/base'
import type { EmberPlusConfig as ModuleConfig } from './config.js'

export enum LoggerLevel {
	Error = 0,
	Warning = 1,
	Information = 2,
	Debug = 3,
	Console = 4,
}

export const loggerLevelChoices: DropdownChoice[] = [
	//	{ id: LoggerLevel.Error, label: 'Error' },
	{ id: LoggerLevel.Warning, label: 'Warning' },
	{ id: LoggerLevel.Information, label: 'Information' },
	{ id: LoggerLevel.Debug, label: 'Debug' },
	{ id: LoggerLevel.Console, label: 'Console' },
]

/**
 * Utility class to manage logging constrained to specified level
 * @param self Module instance
 * @param logLevel Minimum Log Level to action, others are discarded
 *
 */

type loggableTypes = string | object | boolean | number

export class Logger {
	private _self!: InstanceBase<ModuleConfig>
	#minLogLevel: LoggerLevel = LoggerLevel.Console

	constructor(self: InstanceBase<ModuleConfig>, logLevel: LoggerLevel = LoggerLevel.Information) {
		this._self = self
		this.#minLogLevel = logLevel
	}

	/**
	 * @param level Level of message to be logged
	 * @param data Data to be logged. Objects stringified, other data types coerced to string
	 * @returns True if actioned
	 */

	public log(level: LoggerLevel, data: string): boolean {
		const logData = `[${new Date().toJSON()}] ${data}`
		if (level > this.#minLogLevel) return false
		if (level === LoggerLevel.Console) {
			console.log(logData)
		} else {
			const logLevel =
				level === LoggerLevel.Error
					? 'error'
					: level === LoggerLevel.Warning
						? 'warn'
						: level === LoggerLevel.Information
							? 'info'
							: 'debug'
			this._self.log(logLevel, logData)
		}
		return true
	}

	/**
	 * Turn an array of loggableTypes into a string to be logged
	 */

	private buildMsgString(...data: loggableTypes[]): string {
		let msg: string = ''
		for (const element of data) {
			if (msg !== '') msg += ' '
			msg += typeof element === 'object' ? JSON.stringify(element) : element.toString()
		}
		return msg
	}

	/**
	 * Log to Console
	 */
	public console(...data: loggableTypes[]): boolean {
		return this.log(LoggerLevel.Console, this.buildMsgString(...data))
	}

	/**
	 * Log at debug level
	 */
	public debug(...data: loggableTypes[]): boolean {
		return this.log(LoggerLevel.Debug, this.buildMsgString(...data))
	}

	/**
	 * Log at info level
	 */
	public info(...data: loggableTypes[]): boolean {
		return this.log(LoggerLevel.Information, this.buildMsgString(...data))
	}

	/**
	 * Log at warning level
	 */
	public warn(...data: loggableTypes[]): boolean {
		return this.log(LoggerLevel.Warning, this.buildMsgString(...data))
	}

	/**
	 * Log at error level
	 */
	public error(...data: loggableTypes[]): boolean {
		return this.log(LoggerLevel.Error, this.buildMsgString(...data))
	}
}
