import { Model as EmberModel } from '@phillipivan/emberplus-connection'

/** Whether a factor is one the module applies: a positive whole number. The library also takes a negative one */
export function isValidFactor(factor: number | undefined): factor is number {
	return factor !== undefined && Number.isInteger(factor) && factor > 0
}

/**
 * The parameter as the library's displayValue and deviceValue are to see it: without its factor, unless that is a
 * positive whole number. A provider reporting a factor of 0, a negative one or a fraction is taken to have none, so a
 * value is never divided by 0 or turned negative by it
 */
export function withValidFactor<T extends EmberModel.Parameter>(parameter: T): T {
	return parameter.factor === undefined || isValidFactor(parameter.factor)
		? parameter
		: { ...parameter, factor: undefined }
}
