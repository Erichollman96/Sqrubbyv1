export type InferredColumnType =
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'text'

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite' | 'sqlserver'

export interface ColumnConfig {
  name: string
  inferredType: InferredColumnType
  selectedType: InferredColumnType
  stripNonAlnum?: boolean
  // Cleaning controls
  trimWhitespace?: boolean
  normalizeQuotesDashes?: boolean
  caseTransform?: 'none' | 'lower' | 'upper' | 'title'
  autoNumeric?: boolean
  extractReferences?: boolean
  referencesColumnName?: string
  // Column name normalization and duplicate detection
  nameCase?: 'none' | 'lower' | 'upper' | 'title'
  useForDuplicateKey?: boolean
  autoUnderscore?: boolean
  // Regex rules
  regexRules?: { pattern: string; replacement: string; flags?: string }[]
  // Find & Replace mode and simple rules
  findReplaceMode?: 'simple' | 'regex'
  simpleRules?: { find: string; replacement: string; caseSensitive?: boolean }[]
  // Split controls (MVP: split into two parts)
  splitDelimiters?: string
  splitMaxParts?: number
  splitKeepOriginal?: boolean
  // Merge controls (target column will concatenate selected sources with delimiter)
  mergeSources?: number[]
  mergeDelimiter?: string
  // Missing value handling
  missingPolicy?: 'keep-null' | 'default' | 'drop-row' | 'impute'
  missingDefaultValue?: string
  imputeStrategy?: 'mean' | 'median' | 'mode' | 'custom'
  imputeCustomValue?: string
  // SQL type selection
  customSqlTypeName?: string
  typeParamN?: number
  showAllTypes?: boolean
}

export interface TransformPlanColumn {
  name: string
  type: InferredColumnType
}

export interface ParsedCsvData {
  headers: string[]
  rows: string[][]
}



