import { useMemo, useState } from 'react'
import './App.css'
import { parseCsv } from './utils/csv'
import { inferColumnType } from './utils/infer'
import type { ColumnConfig, InferredColumnType, ParsedCsvData, SqlDialect } from './types'
import { buildCreateTableSQL, buildInsertSQL } from './utils/sql'
import { cleanCell } from './utils/clean'

// Dialect-aware type options for the Type dropdown
type TypeOption = { value: string; label: string; hasN?: boolean }

function getTypeOptions(dialect: SqlDialect, showAll: boolean): TypeOption[] {
  if (dialect === 'postgres') {
    const basic: TypeOption[] = [
      { value: 'CHAR(n)', label: 'char(n)', hasN: true },
      { value: 'VARCHAR(n)', label: 'varchar(n)', hasN: true },
      { value: 'INT', label: 'int' },
      { value: 'FLOAT(n)', label: 'float(n)', hasN: true },
      { value: 'DATE', label: 'date' },
      { value: 'TIME', label: 'time' },
      { value: 'TIMESTAMP', label: 'timestamp' },
      { value: 'TEXT', label: 'text' },
    ]
    const more: TypeOption[] = [
      { value: 'SMALLINT', label: 'smallint' },
      { value: 'BIGINT', label: 'bigint' },
      { value: 'REAL', label: 'real' },
      { value: 'DOUBLE PRECISION', label: 'double precision' },
      { value: 'BOOLEAN', label: 'boolean' },
      { value: 'NUMERIC(n)', label: 'numeric(n)', hasN: true },
      { value: 'TIMESTAMPTZ', label: 'timestamp with time zone' },
    ]
    const arr = showAll ? [...basic, ...more] : basic
    return arr.sort((a, b) => a.label.localeCompare(b.label))
  }
  if (dialect === 'mysql') {
    const basic: TypeOption[] = [
      { value: 'CHAR(n)', label: 'char(n)', hasN: true },
      { value: 'VARCHAR(n)', label: 'varchar(n)', hasN: true },
      { value: 'INT', label: 'int' },
      { value: 'FLOAT(n)', label: 'float(n)', hasN: true },
      { value: 'DATE', label: 'date' },
      { value: 'TIME', label: 'time' },
      { value: 'DATETIME', label: 'datetime' },
      { value: 'TIMESTAMP', label: 'timestamp' },
      { value: 'TEXT', label: 'text' },
    ]
    const more: TypeOption[] = [
      { value: 'TINYINT', label: 'tinyint' },
      { value: 'SMALLINT', label: 'smallint' },
      { value: 'BIGINT', label: 'bigint' },
      { value: 'DOUBLE', label: 'double' },
      { value: 'DECIMAL(n)', label: 'decimal(n)', hasN: true },
      { value: 'YEAR', label: 'year' },
    ]
    const arr = showAll ? [...basic, ...more] : basic
    return arr.sort((a, b) => a.label.localeCompare(b.label))
  }
  if (dialect === 'sqlserver') {
    // Based on W3Schools SQL Server data types
    const basic: TypeOption[] = [
      { value: 'CHAR(n)', label: 'char(n)', hasN: true },
      { value: 'VARCHAR(n)', label: 'varchar(n)', hasN: true },
      { value: 'INT', label: 'int' },
      { value: 'FLOAT(n)', label: 'float(n)', hasN: true },
      { value: 'DATE', label: 'date' },
      { value: 'TIME', label: 'time' },
      { value: 'DATETIME', label: 'datetime' },
      { value: 'TIMESTAMP', label: 'timestamp' },
      { value: 'TEXT', label: 'text' },
    ]
    const more: TypeOption[] = [
      { value: 'SMALLINT', label: 'smallint' },
      { value: 'BIGINT', label: 'bigint' },
      { value: 'REAL', label: 'real' },
      { value: 'DECIMAL(n)', label: 'decimal(n)', hasN: true },
      { value: 'DATETIME2', label: 'datetime2' },
      { value: 'SMALLDATETIME', label: 'smalldatetime' },
      { value: 'DATETIMEOFFSET', label: 'datetimeoffset' },
      { value: 'UNIQUEIDENTIFIER', label: 'uniqueidentifier' },
      { value: 'XML', label: 'xml' },
    ]
    const arr = showAll ? [...basic, ...more] : basic
    return arr.sort((a, b) => a.label.localeCompare(b.label))
  }
  // sqlite
  const sqliteOptions: TypeOption[] = [
    { value: 'NULL', label: 'null' },
    { value: 'INTEGER', label: 'integer' },
    { value: 'REAL', label: 'real' },
    { value: 'TEXT', label: 'text' },
    { value: 'BLOB', label: 'blob' },
  ]
  return sqliteOptions
}

function defaultCustomType(selected: InferredColumnType, dialect: SqlDialect): string {
  switch (selected) {
    case 'integer':
      return dialect === 'postgres' ? 'INT' : 'INT'
    case 'decimal':
      return dialect === 'sqlite' ? 'REAL' : 'FLOAT(n)'
    case 'boolean':
      return dialect === 'mysql' ? 'TINYINT' : 'BOOLEAN'
    case 'date':
      return 'DATE'
    case 'datetime':
      return dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME'
    case 'text':
    default:
      return 'TEXT'
  }
}

function App() {
  const [csvText, setCsvText] = useState('')
  const [csv, setCsv] = useState<ParsedCsvData | null>(null)
  const [columns, setColumns] = useState<ColumnConfig[]>([])
  const [tableName, setTableName] = useState('my_table')
  const [dialect, setDialect] = useState<SqlDialect>('postgres')
  const [insertSQL, setInsertSQL] = useState('')
  const [createSQL, setCreateSQL] = useState('')
  const [skippedRows, setSkippedRows] = useState(0)
  const [openConfigIndex, setOpenConfigIndex] = useState<number | null>(null)
  const [activeTabByIndex, setActiveTabByIndex] = useState<Record<number, string>>({})
  const setActiveTab = (i: number, tab: string) => setActiveTabByIndex((prev) => ({ ...prev, [i]: tab }))
  const [showAllTypes, setShowAllTypes] = useState(false)

  const handleParse = () => {
    const parsed = parseCsv(csvText)
    setCsv(parsed)
    const inferred: ColumnConfig[] = parsed.headers.map((h, idx) => {
      const samples = parsed.rows.map((r) => r[idx] ?? '')
      const t = inferColumnType(samples)
      return {
        name: h,
        inferredType: t,
        selectedType: t,
        stripNonAlnum: false,
        trimWhitespace: true,
        normalizeQuotesDashes: true,
        caseTransform: 'none',
        autoNumeric: false,
        extractReferences: false,
        referencesColumnName: `${h}_refs`,
        nameCase: 'none',
        useForDuplicateKey: false,
        regexRules: [],
        splitDelimiters: '',
        splitMaxParts: 2,
        splitKeepOriginal: true,
        mergeSources: [],
        mergeDelimiter: ' ',
        missingPolicy: 'keep-null',
        missingDefaultValue: '',
        imputeStrategy: 'mode',
        imputeCustomValue: '',
        autoUnderscore: true,
      }
    })
    setColumns(inferred)
    setInsertSQL('')
    setCreateSQL('')
    setSkippedRows(0)
  }

  const canGenerate = useMemo(() => csv && columns.length > 0, [csv, columns])

  const duplicateRowIndexes = useMemo(() => {
    if (!csv) return new Set<number>()
    const keyIndexes = columns
      .map((c, i) => (c.useForDuplicateKey ? i : -1))
      .filter((i) => i >= 0)
    if (keyIndexes.length === 0) return new Set<number>()
    const seen = new Map<string, number>()
    const dupes = new Set<number>()
    for (let r = 0; r < csv.rows.length; r++) {
      const row = csv.rows[r]
      const key = keyIndexes
        .map((ci) => {
          const cfg = columns[ci]
          const raw = row[ci] ?? ''
          return cleanCell(raw, cfg).value
        })
        .join('\u0001')
      if (key.trim() === '') continue
      if (seen.has(key)) {
        dupes.add(r)
      } else {
        seen.set(key, r)
      }
    }
    return dupes
  }, [csv, columns])

  const handleGenerateSQL = () => {
    if (!csv) return
    const create = buildCreateTableSQL(tableName, columns, dialect)
    const { sql, skippedRows } = buildInsertSQL(tableName, csv, columns, dialect)
    setCreateSQL(create)
    setInsertSQL(sql)
    setSkippedRows(skippedRows)
  }

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
  }

  const updateColumn = (index: number, updates: Partial<ColumnConfig>) => {
    setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)))
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h2>CSV to SQL Table Generator</h2>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv,text/csv" onChange={onFileSelected} />
        <button onClick={handleParse} disabled={!csvText}>Parse CSV</button>
        <label>
          Table name:
          <input
            style={{ marginLeft: 8 }}
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
        </label>
        <label>
          Dialect:
          <select style={{ marginLeft: 8 }} value={dialect} onChange={(e) => setDialect(e.target.value as SqlDialect)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="sqlite">SQLite</option>
            <option value="sqlserver">SQL Server</option>
          </select>
        </label>
        <button onClick={() => {
          if (!csv) {
            window.alert('Please upload a CSV file and click "Parse CSV" before generating SQL.')
            return
          }
          handleGenerateSQL()
        }} disabled={!canGenerate}>Generate SQL</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea
          placeholder="Paste CSV here or choose a file"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </div>

      {csv && columns.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Preview & Column Settings</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: 6 }} title="Duplicate flag based on selected key columns">Dup</th>
                  {csv.headers.map((h, i) => (
                    <th key={i} style={{ border: '1px solid #ccc', padding: 6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.rows.slice(0, 5).map((row, r) => (
                  <tr key={r}>
                    <td style={{ border: '1px solid #eee', padding: 6 }}>{duplicateRowIndexes.has(r) ? 'DUP' : ''}</td>
                    {row.map((cell, c) => (
                      <td key={c} style={{ border: '1px solid #eee', padding: 6 }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>Transformed Preview (first 5 rows)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    {columns.map((col, i) => (
                      <th key={i} style={{ border: '1px solid #ccc', padding: 6 }}>{col.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csv.rows.slice(0, 5).map((row, r) => (
                    <tr key={r}>
                      {columns.map((col, c) => (
                        <td key={c} style={{ border: '1px solid #eee', padding: 6 }}>
                          {cleanCell(row[c] ?? '', col).value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Column Configuration</h4>
            <label title="Show every datatype for the selected SQL dialect" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '6px 0 8px 0' }}>
              <input type="checkbox" checked={showAllTypes} onChange={(e) => setShowAllTypes(e.target.checked)} /> Show all datatypes
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>Name</div>
              <div style={{ fontWeight: 600 }}>Inferred</div>
              <div style={{ fontWeight: 600 }}>Type</div>
              <div style={{ fontWeight: 600 }} title="Include in duplicate-detection key">Dup Key</div>
              <div />
              {columns.map((col, i) => (
                <>
                  <input
                    value={col.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                    title="Edit column name"
                  />
                  <div>{col.inferredType}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(() => {
                      const options = getTypeOptions(dialect, showAllTypes)
                      const current = col.customSqlTypeName ?? defaultCustomType(col.selectedType, dialect)
                      const selectedOpt = options.find(o => o.value === current)
                      const needsN = selectedOpt?.hasN || /\(\s*n\s*\)/i.test(current)
                      return (
                        <>
                          <select
                            value={current}
                            onChange={(e) => updateColumn(i, { customSqlTypeName: e.target.value })}
                            title="SQL type"
                          >
                            {options.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {needsN && (
                            <label title="Set parameter n for types like char(n), varchar(n), float(n)">n=
                              <input style={{ width: 60, marginLeft: 4 }} type="number" min={1} value={col.typeParamN ?? 0}
                                onChange={(e) => updateColumn(i, { typeParamN: Number(e.target.value) })} />
                            </label>
                          )}
                          
                        </>
                      )
                    })()}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!col.useForDuplicateKey}
                      onChange={(e) => updateColumn(i, { useForDuplicateKey: e.target.checked })}
                      title="Include in duplicate-detection key"
                    />
                  </label>
                  <button onClick={() => setOpenConfigIndex(openConfigIndex === i ? null : i)} title="Configure advanced settings">
                    {openConfigIndex === i ? 'Hide' : 'Configure'}
                  </button>
                </>
              ))}
            </div>

            {openConfigIndex !== null && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {['Basics', 'References', 'Find & Replace', 'Split', 'Merge', 'Missing', 'Naming'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(openConfigIndex, tab)}
                      style={{ fontWeight: (activeTabByIndex[openConfigIndex] ?? 'Basics') === tab ? 700 : 400 }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {(() => {
                  const i = openConfigIndex as number
                  const col = columns[i]
                  const tab = activeTabByIndex[i] ?? 'Basics'
                  if (tab === 'Basics') {
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(160px, 1fr))', gap: 8 }}>
                        <label title='Trim leading/trailing whitespace. Example: "  ACME  " -> "ACME"'><input type="checkbox" checked={!!col.trimWhitespace} onChange={(e) => updateColumn(i, { trimWhitespace: e.target.checked })} /> Trim</label>
                        <label title='Convert curly quotes and dashes to straight. Example: "smart" quotes -> "smart" quotes'><input type="checkbox" checked={!!col.normalizeQuotesDashes} onChange={(e) => updateColumn(i, { normalizeQuotesDashes: e.target.checked })} /> Normalize Quotes/Dashes</label>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Case</div>
                          <select value={col.caseTransform ?? 'none'} onChange={(e) => updateColumn(i, { caseTransform: e.target.value as ColumnConfig['caseTransform'] })}>
                            <option value="none">none</option>
                            <option value="lower">lower</option>
                            <option value="upper">upper</option>
                            <option value="title">title</option>
                          </select>
                        </div>
                        <label title="Parse numbers from currency/percent formats. Examples: '$1,200.50' -> '1200.5', '12%' -> '12'"><input type="checkbox" checked={!!col.autoNumeric} onChange={(e) => updateColumn(i, { autoNumeric: e.target.checked })} /> Auto Numeric</label>
                        <label title="Remove everything except A–Z, a–z, 0–9. Useful for IDs and codes."><input type="checkbox" checked={!!col.stripNonAlnum} onChange={(e) => updateColumn(i, { stripNonAlnum: e.target.checked })} /> Strip Non‑Alnum</label>
                      </div>
                    )
                  }
                  if (tab === 'References') {
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8 }}>
                        <label title="Remove reference markers like [3], [a], † and store them in a separate column."><input type="checkbox" checked={!!col.extractReferences} onChange={(e) => updateColumn(i, { extractReferences: e.target.checked })} /> Strip Refs</label>
                        <div style={{ alignSelf: 'center' }}>New Column Name</div>
                        <input placeholder={`${col.name}_refs`} value={col.referencesColumnName ?? ''} onChange={(e) => updateColumn(i, { referencesColumnName: e.target.value })} disabled={!col.extractReferences} title="Refs Column" />
                        <div title="Preview (first 2)" style={{ gridColumn: '1 / span 1' }}>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Preview</div>
                          {(csv?.rows.slice(0, 2) ?? []).map((row, r) => {
                            const ex = cleanCell(row[i] ?? '', col)
                            return <div key={r} style={{ fontFamily: 'monospace' }}>{ex.refs || ''}</div>
                          })}
                        </div>
                      </div>
                    )
                  }
                  if (tab === 'Find & Replace') {
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>Mode</div>
                            <select value={col.findReplaceMode ?? 'simple'} onChange={(e) => updateColumn(i, { findReplaceMode: e.target.value as any })}>
                              <option value="simple">Simple</option>
                              <option value="regex">Regex</option>
                            </select>
                          </div>
                          <button onClick={() => {
                            if ((col.findReplaceMode ?? 'simple') === 'regex') {
                              window.alert('Regex find/replace\n\nPattern: a JavaScript regular expression (without slashes).\nFlags: g (global), i (ignore case), m (multiline).\nReplacement: replacement text; supports $1, $2 for capture groups.\n\nExample:\nPattern: (\\d{4})-(\\d{2})-(\\d{2})\nFlags: g\nReplacement: $2/$3/$1\nResult: 2024-03-15 -> 03/15/2024')
                            } else {
                              window.alert('Simple find & replace\n\nFind: plain text to look for (case-insensitive by default).\nCase sensitive: toggle to match case.\nReplacement: text that replaces matches.\n\nExample:\nFind: Ltd\nReplacement: Limited\nCase sensitive: off\nResult: ACME LTD -> ACME Limited')
                            }
                          }}>How to use</button>
                        </div>
                        {(col.findReplaceMode ?? 'simple') === 'simple' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            <button onClick={() => updateColumn(i, { simpleRules: [ ...(col.simpleRules ?? []), { find: '', replacement: '', caseSensitive: false } ] })}>Add Rule</button>
                            {(col.simpleRules ?? []).map((rule, ri) => (
                              <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input placeholder="Find" value={rule.find} onChange={(e) => { const rules = [...(col.simpleRules ?? [])]; rules[ri] = { ...rules[ri], find: e.target.value }; updateColumn(i, { simpleRules: rules }) }} />
                                <input placeholder="Replacement" value={rule.replacement} onChange={(e) => { const rules = [...(col.simpleRules ?? [])]; rules[ri] = { ...rules[ri], replacement: e.target.value }; updateColumn(i, { simpleRules: rules }) }} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={!!rule.caseSensitive} onChange={(e) => { const rules = [...(col.simpleRules ?? [])]; rules[ri] = { ...rules[ri], caseSensitive: e.target.checked }; updateColumn(i, { simpleRules: rules }) }} /> Case sensitive</label>
                                <button onClick={() => { const rules = [...(col.simpleRules ?? [])]; rules.splice(ri, 1); updateColumn(i, { simpleRules: rules }) }}>✕</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                          {(col.regexRules ?? []).map((rule, ri) => (
                            <div key={ri} style={{ display: 'flex', gap: 6 }}>
                              <input placeholder="Pattern" title="Regex pattern, e.g., \\d+ or (foo|bar)" value={rule.pattern} onChange={(e) => { const rules = [...(col.regexRules ?? [])]; rules[ri] = { ...rules[ri], pattern: e.target.value }; updateColumn(i, { regexRules: rules }) }} />
                              <input placeholder="Flags" title="e.g., g (global), i (ignore case)" style={{ width: 60 }} value={rule.flags ?? ''} onChange={(e) => { const rules = [...(col.regexRules ?? [])]; rules[ri] = { ...rules[ri], flags: e.target.value }; updateColumn(i, { regexRules: rules }) }} />
                              <input placeholder="Replacement" title="Replacement text; use $1 for capture groups" value={rule.replacement} onChange={(e) => { const rules = [...(col.regexRules ?? [])]; rules[ri] = { ...rules[ri], replacement: e.target.value }; updateColumn(i, { regexRules: rules }) }} />
                              <button onClick={() => { const rules = [...(col.regexRules ?? [])]; rules.splice(ri, 1); updateColumn(i, { regexRules: rules }) }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => updateColumn(i, { regexRules: [ ...(col.regexRules ?? []), { pattern: '', replacement: '', flags: 'g' } ] })} style={{ alignSelf: 'flex-start' }}>Add Regex Rule</button>
                        </div>
                        )}
                      </div>
                    )
                  }
                  if (tab === 'Split') {
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <button onClick={() => {
                            window.alert('Split a column into parts by delimiters.\n\nEnter one or more delimiter characters (e.g., ,.-/) and choose the maximum number of parts.\nExample: "2020-2022" with delimiters - and Max Parts 2 -> part1=2020, part2=2022.\nEnable "Keep Original" to retain the original column as well.')
                          }}>How to use</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                          <div>Delimiters</div>
                          <input placeholder=",.-/" value={col.splitDelimiters ?? ''} onChange={(e) => updateColumn(i, { splitDelimiters: e.target.value })} title="Characters to split on" />
                          <div />
                          <div>Max Parts</div>
                          <input type="number" min={2} value={col.splitMaxParts ?? 2} onChange={(e) => updateColumn(i, { splitMaxParts: Number(e.target.value) })} title="Max number of parts" />
                          <div />
                          <div>Keep Original</div>
                          <label><input type="checkbox" checked={!!col.splitKeepOriginal} onChange={(e) => updateColumn(i, { splitKeepOriginal: e.target.checked })} /> Keep Original</label>
                          <div />
                        </div>
                      </div>
                    )
                  }
                  if (tab === 'Merge') {
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <button onClick={() => {
                            window.alert('Merge multiple columns into one target column.\n\nSelect the source columns and specify a delimiter (e.g., space, comma).\nExample: First Name + Last Name with delimiter " " -> "First Last"')
                          }}>How to use</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 8, alignItems: 'start' }}>
                          <div>Merge Sources</div>
                          <select multiple size={5} value={(col.mergeSources ?? []).map(String)} onChange={(e) => { const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value)); updateColumn(i, { mergeSources: selected }) }} style={{ minWidth: 260 }}>
                            {columns.map((opt, oi) => (
                              <option key={oi} value={oi} disabled={oi === i}>{opt.name}</option>
                            ))}
                          </select>
                          <div>Merge Delimiter</div>
                          <input placeholder="space, comma, etc." value={col.mergeDelimiter ?? ' '} onChange={(e) => updateColumn(i, { mergeDelimiter: e.target.value })} />
                        </div>
                      </div>
                    )
                  }
                  if (tab === 'Missing') {
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Missing Policy</div>
                          <select value={col.missingPolicy ?? 'keep-null'} onChange={(e) => updateColumn(i, { missingPolicy: e.target.value as ColumnConfig['missingPolicy'] })}>
                            <option value="keep-null">keep-null</option>
                            <option value="default">default</option>
                            <option value="drop-row">drop-row</option>
                            <option value="impute">impute</option>
                          </select>
                        </div>
                        <input placeholder="default value" value={col.missingDefaultValue ?? ''} onChange={(e) => updateColumn(i, { missingDefaultValue: e.target.value })} disabled={(col.missingPolicy ?? 'keep-null') !== 'default'} />
                        <select value={col.imputeStrategy ?? 'mode'} onChange={(e) => updateColumn(i, { imputeStrategy: e.target.value as ColumnConfig['imputeStrategy'] })} disabled={(col.missingPolicy ?? 'keep-null') !== 'impute'}>
                          <option value="mean">mean</option>
                          <option value="median">median</option>
                          <option value="mode">mode</option>
                          <option value="custom">custom</option>
                        </select>
                        <input placeholder="custom impute value" value={col.imputeCustomValue ?? ''} onChange={(e) => updateColumn(i, { imputeCustomValue: e.target.value })} disabled={!col.imputeStrategy || col.imputeStrategy !== 'custom' || (col.missingPolicy ?? 'keep-null') !== 'impute'} />
                      </div>
                    )
                  }
                  // Naming
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Name Case</div>
                        <select value={col.nameCase ?? 'none'} onChange={(e) => { const mode = e.target.value as NonNullable<ColumnConfig['nameCase']>; let newName = col.name; if (mode === 'lower') newName = col.name.toLowerCase(); else if (mode === 'upper') newName = col.name.toUpperCase(); else if (mode === 'title') newName = col.name.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); updateColumn(i, { nameCase: mode, name: newName }) }}>
                          <option value="none">none</option>
                          <option value="lower">lower</option>
                          <option value="upper">upper</option>
                          <option value="title">title</option>
                        </select>
                      </div>
                      <label title="Underscore Names"><input type="checkbox" checked={!!col.autoUnderscore} onChange={(e) => updateColumn(i, { autoUnderscore: e.target.checked })} /> Underscore Names</label>
                      <div title="Preview (first 2)">
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Preview</div>
                        {(csv?.rows.slice(0, 2) ?? []).map((row, r) => (
                          <div key={r} style={{ fontFamily: 'monospace' }}>{cleanCell(row[i] ?? '', col).value}</div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {(createSQL || insertSQL) && (
        <div style={{ marginTop: 16 }}>
          <h3>SQL Output</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => navigator.clipboard.writeText(`${createSQL}\n\n${insertSQL}`)}
              disabled={!createSQL && !insertSQL}
            >
              Copy All
            </button>
            {skippedRows > 0 && <span>Skipped rows: {skippedRows}</span>}
          </div>
          {createSQL && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>CREATE TABLE</div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{createSQL}</pre>
            </div>
          )}
          {insertSQL && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>INSERT</div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{insertSQL}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
