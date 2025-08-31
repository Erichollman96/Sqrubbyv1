import type { ColumnConfig, InferredColumnType, ParsedCsvData, SqlDialect } from '../types'
import { cleanCell } from './clean'

function quoteIdentifier(name: string, dialect: SqlDialect): string {
  switch (dialect) {
    case 'postgres':
      return '"' + name.split('"').join('""') + '"'
    case 'mysql':
      return '`' + name.split('`').join('``') + '`'
    case 'sqlite':
      return '"' + name.split('"').join('""') + '"'
    case 'sqlserver':
      return '[' + name.split(']').join(']]') + ']'
  }
}

function sqlTypeFromConfig(c: ColumnConfig, dialect: SqlDialect): string {
  if (c.customSqlTypeName) {
    if (typeof c.typeParamN === 'number' && /(\(\s*n\s*\))/i.test(c.customSqlTypeName)) {
      return c.customSqlTypeName.replace(/\(\s*n\s*\)/i, `(${Math.max(1, c.typeParamN)})`)
    }
    return c.customSqlTypeName
  }
  switch (c.selectedType) {
    case 'integer':
      return dialect === 'postgres' ? 'INTEGER' : 'INT'
    case 'decimal':
      return 'DECIMAL(38, 10)'
    case 'boolean':
      return dialect === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN'
    case 'date':
      return 'DATE'
    case 'datetime':
      return dialect === 'sqlite' ? 'TEXT' : 'TIMESTAMP'
    case 'text':
      return dialect === 'sqlserver' ? 'NVARCHAR(MAX)' : 'TEXT'
  }
}

function escapeString(value: string, _dialect: SqlDialect): string {
  // For simplicity, standard single-quoted escaping for most dialects
  return "'" + value.split("'").join("''") + "'"
}

function normalizeBoolean(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (['true', 't', 'yes', 'y', '1'].includes(v)) return '1'
  if (['false', 'f', 'no', 'n', '0'].includes(v)) return '0'
  return null
}

function valueToSql(value: string, type: InferredColumnType, dialect: SqlDialect): string | null {
  // Treat empty as mismatch so policy can decide (null/default/skip-row)
  if (value == null || value === '') return null
  switch (type) {
    case 'integer':
      return /^[-+]?\d+$/.test(value) ? value : null
    case 'decimal':
      return /^[-+]?\d*(?:\.\d+)?$/.test(value) ? value : null
    case 'boolean': {
      const b = normalizeBoolean(value)
      if (b == null) return null
      return dialect === 'postgres' ? (b === '1' ? 'TRUE' : 'FALSE') : b
    }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? escapeString(value, dialect) : null
    case 'datetime':
      return /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/.test(value) ? escapeString(value, dialect) : null
    case 'text':
      return escapeString(value, dialect)
  }
}

export function buildCreateTableSQL(
  tableName: string,
  columns: ColumnConfig[],
  dialect: SqlDialect,
): string {
  const outDefs: string[] = []
  for (const c of columns) {
    const baseName = (c.autoUnderscore ? c.name.replace(/\s+/g, '_') : c.name)
    const includeOriginal = !c.splitDelimiters || (c.splitDelimiters === '' || c.splitKeepOriginal)
    if (includeOriginal) {
      outDefs.push(`${quoteIdentifier(baseName, dialect)} ${sqlTypeFromConfig(c, dialect)}`)
    }
    // Split parts
    if (c.splitDelimiters && c.splitDelimiters !== '' && (c.splitMaxParts ?? 0) >= 2) {
      const maxParts = c.splitMaxParts as number
      for (let p = 1; p <= maxParts; p++) {
        const partName = `${baseName}_${p}`
        outDefs.push(`${quoteIdentifier(partName, dialect)} ${sqlTypeFromConfig(c, dialect)}`)
      }
    }
    // References column
    if (c.extractReferences && c.referencesColumnName) {
      const refName = c.autoUnderscore ? (c.referencesColumnName as string).replace(/\s+/g, '_') : (c.referencesColumnName as string)
      outDefs.push(`${quoteIdentifier(refName, dialect)} TEXT`)
    }
  }
  const cols = outDefs.join(',\n  ')
  return `CREATE TABLE ${quoteIdentifier(tableName, dialect)} (\n  ${cols}\n);`
}

export function buildInsertSQL(
  tableName: string,
  csv: ParsedCsvData,
  columns: ColumnConfig[],
  dialect: SqlDialect,
): { sql: string; skippedRows: number } {
  // Build output column names in the same order as CREATE TABLE
  const outNames: string[] = []
  for (const c of columns) {
    const baseName = (c.autoUnderscore ? c.name.replace(/\s+/g, '_') : c.name)
    const includeOriginal = !c.splitDelimiters || (c.splitDelimiters === '' || c.splitKeepOriginal)
    if (includeOriginal) {
      outNames.push(quoteIdentifier(baseName, dialect))
    }
    if (c.splitDelimiters && c.splitDelimiters !== '' && (c.splitMaxParts ?? 0) >= 2) {
      const maxParts = c.splitMaxParts as number
      for (let p = 1; p <= maxParts; p++) {
        const partName = `${baseName}_${p}`
        outNames.push(quoteIdentifier(partName, dialect))
      }
    }
    if (c.extractReferences && c.referencesColumnName) {
      const refName = c.autoUnderscore ? (c.referencesColumnName as string).replace(/\s+/g, '_') : (c.referencesColumnName as string)
      outNames.push(quoteIdentifier(refName, dialect))
    }
  }
  const colNames = outNames.join(', ')

  // Precompute imputation values per column
  const imputeRawValue: (string | undefined)[] = columns.map(() => undefined)
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if ((col.missingPolicy ?? 'keep-null') !== 'impute') continue
    const values: string[] = []
    for (const row of csv.rows) {
      const raw = row[i] ?? ''
      const cleaned = cleanCell(raw, col).value
      if (cleaned != null && cleaned !== '') values.push(cleaned)
    }
    if (values.length === 0) continue
    if (col.imputeStrategy === 'custom') {
      imputeRawValue[i] = col.imputeCustomValue ?? ''
    } else if (col.imputeStrategy === 'mean' || col.imputeStrategy === 'median') {
      const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n))
      if (nums.length === 0) continue
      if (col.imputeStrategy === 'mean') {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length
        imputeRawValue[i] = String(mean)
      } else {
        nums.sort((a, b) => a - b)
        const mid = Math.floor(nums.length / 2)
        const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
        imputeRawValue[i] = String(median)
      }
    } else {
      // mode
      const counts = new Map<string, number>()
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
      let best: string | undefined
      let bestCount = -1
      for (const [k, ct] of counts) {
        if (ct > bestCount) {
          best = k
          bestCount = ct
        }
      }
      imputeRawValue[i] = best
    }
  }

  let skippedRows = 0
  const valuesClauses: string[] = []
  for (const row of csv.rows) {
    const renderedAll: (string | null)[] = []
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const cellRaw = row[i] ?? ''
      let baseValue = cleanCell(cellRaw, col).value
      // Merge
      if (col.mergeSources && col.mergeSources.length > 0) {
        const parts: string[] = []
        for (const si of col.mergeSources) {
          const raw = row[si] ?? ''
          const sv = cleanCell(raw, columns[si]).value
          if (sv != null && sv !== '') parts.push(sv)
        }
        baseValue = parts.join(col.mergeDelimiter ?? ' ')
      }
      const produced: (string | null)[] = []
      const includeOriginal = !col.splitDelimiters || (col.splitDelimiters === '' || col.splitKeepOriginal)
      const maxParts = (col.splitDelimiters && col.splitDelimiters !== '' && (col.splitMaxParts ?? 0) >= 2) ? (col.splitMaxParts as number) : 0
      // Original
      if (includeOriginal) {
        produced.push(valueToSql(baseValue, col.selectedType, dialect))
      }
      // Split parts
      if (maxParts > 0) {
        const delims = (col.splitDelimiters as string)
        const cls = delims.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(`[${cls}]`)
        const tokens = (baseValue ?? '').split(re)
        for (let p = 0; p < maxParts; p++) {
          const token = tokens[p] ?? ''
          produced.push(valueToSql(token, col.selectedType, dialect))
        }
      }
      // References
      if (col.extractReferences && col.referencesColumnName) {
        const ex = cleanCell(cellRaw, col)
        produced.push(ex.refs ? `'${ex.refs.split("'").join("''")}'` : 'NULL')
      }

      // Missing policy application per produced cell (excluding refs which already handled as NULL when empty)
      for (let pi = 0; pi < produced.length; pi++) {
        let vsql = produced[pi]
        if (vsql == null) {
          const policy = col.missingPolicy ?? 'keep-null'
          if (policy === 'default') {
            const dv = valueToSql(col.missingDefaultValue ?? '', col.selectedType, dialect)
            vsql = dv ?? 'NULL'
          } else if (policy === 'drop-row') {
            vsql = null // marker; we'll drop row below by tracking a flag
          } else if (policy === 'impute') {
            const imp = imputeRawValue[i]
            const iv = valueToSql(imp ?? '', col.selectedType, dialect)
            vsql = iv ?? 'NULL'
          } else {
            vsql = 'NULL'
          }
        }
        produced[pi] = vsql
      }

      // If any produced cell requested drop-row, mark by injecting a special token
      if (produced.some((x) => x === null)) {
        // Use a unique marker to signal row drop
        renderedAll.length = 0
        renderedAll.push('__DROP_ROW__' as unknown as string)
        break
      }

      renderedAll.push(...produced)
    }
    if (renderedAll[0] === ('__DROP_ROW__' as unknown as string)) {
      skippedRows++
      continue
    }
    const line = renderedAll.map((x) => (x == null ? 'NULL' : x)).join(', ')
    valuesClauses.push(`(${line})`)
  }
  const valuesSql = valuesClauses.join(',\n')
  const sql = valuesClauses.length
    ? `INSERT INTO ${quoteIdentifier(tableName, dialect)} (${colNames})\nVALUES\n${valuesSql};`
    : ''
  return { sql, skippedRows }
}




