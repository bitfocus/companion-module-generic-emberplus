import { InputValue } from '@companion-module/base'

export const MEDIA_PLAYER_SOURCE_CLIP_OFFSET = 1000

export function assertUnreachable(_never: never): void {
  // throw new Error('Unreachable')
}

export function literal<T>(val: T): T {
  return val
}

export type Required<T> = T extends object ? { [P in keyof T]-?: NonNullable<T[P]> } : T

export enum NumberComparitor {
  Equal = 'eq',
  NotEqual = 'ne',
  LessThan = 'lt',
  LessThanEqual = 'lte',
  GreaterThan = 'gt',
  GreaterThanEqual = 'gte',
}

export function compareNumber(
  target: InputValue | undefined,
  comparitor: InputValue | undefined,
  currentValue: number
): boolean {
  const targetValue = Number(target)
  if (isNaN(targetValue)) {
    return false
  }

  switch (comparitor) {
    case NumberComparitor.GreaterThan:
      return currentValue > targetValue
    case NumberComparitor.GreaterThanEqual:
      return currentValue >= targetValue
    case NumberComparitor.LessThan:
      return currentValue < targetValue
    case NumberComparitor.LessThanEqual:
      return currentValue <= targetValue
    case NumberComparitor.NotEqual:
      return currentValue != targetValue
    default:
      return currentValue === targetValue
  }
}
