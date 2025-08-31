import type { InferredColumnType } from '../types'

const INTEGER_REGEX = /^[-+]?\d+$/
const DECIMAL_REGEX = /^[-+]?\d*(?:\.\d+)?$/
const BOOLEAN_TRUTHY = new Set(['true', 't', 'yes', 'y', '1'])
const BOOLEAN_FALSEY = new Set(['false', 'f', 'no', 'n', '0'])

function isInteger(value: string): boolean {
  return INTEGER_REGEX.test(value)
}

function isDecimal(value: string): boolean {
  if (value.trim() === '') return false
  if (INTEGER_REGEX.test(value)) return true
  return DECIMAL_REGEX.test(value)
}

function isBoolean(value: string): boolean {
  const v = value.trim().toLowerCase()
  return BOOLEAN_TRUTHY.has(v) || BOOLEAN_FALSEY.has(v)
}

function isDate(value: string): boolean {
  // Rough heuristic for YYYY-MM-DD or similar
  // Avoid expensive Date parsing on obviously wrong formats
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

function isDateTime(value: string): boolean {
  // ISO-like date time
  if (!/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

export function inferColumnType(samples: string[]): InferredColumnType {
  // Ignore empty strings during inference
  const nonEmpty = samples.filter((s) => s != null && String(s).trim() !== '')
  if (nonEmpty.length === 0) return 'text'

  if (nonEmpty.every(isInteger)) return 'integer'
  if (nonEmpty.every(isDecimal)) return 'decimal'
  if (nonEmpty.every(isBoolean)) return 'boolean'
  if (nonEmpty.every(isDateTime)) return 'datetime'
  if (nonEmpty.every(isDate)) return 'date'
  return 'text'
}



