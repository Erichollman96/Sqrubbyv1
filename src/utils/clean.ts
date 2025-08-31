import type { ColumnConfig } from '../types'

function normalizeQuotesAndDashes(input: string): string {
  let s = input
  // Curly quotes to straight quotes
  s = s.replace(/[\u2018\u2019\u201B\u2032]/g, "'")
  s = s.replace(/[\u201C\u201D\u201F\u2033]/g, '"')
  // En dash, em dash to hyphen
  s = s.replace(/[\u2013\u2014\u2212]/g, '-')
  // Non-breaking spaces to normal spaces
  s = s.replace(/\u00A0/g, ' ')
  return s
}

function applyCaseTransform(input: string, mode: ColumnConfig['caseTransform']): string {
  switch (mode) {
    case 'lower':
      return input.toLowerCase()
    case 'upper':
      return input.toUpperCase()
    case 'title': {
      return input.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    }
    case 'none':
    default:
      return input
  }
}

function extractReferenceMarkers(input: string): { value: string; refs: string } {
  let refs: string[] = []
  let s = input
  // [3], [a], [12]
  s = s.replace(/\[(?:\w|\d)+\]/g, (m) => {
    refs.push(m)
    return ''
  })
  // Common footnote markers: †, ‡, *, ‡‡, etc.
  s = s.replace(/[\u2020\u2021\*]+/g, (m) => {
    refs.push(m)
    return ''
  })
  return { value: s, refs: refs.join(' ').trim() }
}

function cleanNumericString(input: string): string {
  // Remove currency symbols, commas, spaces; keep digits, sign, dot
  let s = input.trim()
  // Handle percentages by removing % but leaving the number as-is
  s = s.replace(/%/g, '')
  // Remove currency symbols like $, €, £, ¥
  s = s.replace(/[\$€£¥]/g, '')
  // Remove thousand separators
  s = s.replace(/,/g, '')
  // Collapse internal spaces
  s = s.replace(/\s+/g, '')
  return s
}

export function cleanCell(raw: string, config: ColumnConfig): { value: string; refs?: string } {
  let s = raw ?? ''
  let refs: string | undefined

  if (config.trimWhitespace) {
    s = s.trim()
  }
  if (config.normalizeQuotesDashes) {
    s = normalizeQuotesAndDashes(s)
  }
  if (config.caseTransform && config.caseTransform !== 'none') {
    s = applyCaseTransform(s, config.caseTransform)
  }
  // Apply simple find/replace rules (before regex)
  if (config.findReplaceMode !== 'regex' && config.simpleRules && Array.isArray(config.simpleRules)) {
    for (const rule of config.simpleRules) {
      if (!rule || rule.find == null) continue
      const replacement = rule.replacement ?? ''
      if (rule.caseSensitive) {
        s = s.split(rule.find).join(replacement)
      } else {
        const needle = rule.find.toLowerCase()
        if (needle === '') continue
        let out = ''
        let idxFrom = 0
        const lower = s.toLowerCase()
        while (idxFrom < s.length) {
          const idx = lower.indexOf(needle, idxFrom)
          if (idx === -1) {
            out += s.slice(idxFrom)
            break
          }
          out += s.slice(idxFrom, idx) + replacement
          idxFrom = idx + needle.length
        }
        s = out
      }
    }
  }
  // Apply custom regex rules (sequential)
  if (config.regexRules && Array.isArray(config.regexRules)) {
    for (const rule of config.regexRules) {
      if (!rule || !rule.pattern) continue
      try {
        const re = new RegExp(rule.pattern, rule.flags ?? 'g')
        s = s.replace(re, rule.replacement ?? '')
      } catch {
        // Ignore invalid regex patterns
      }
    }
  }
  if (config.extractReferences) {
    const ex = extractReferenceMarkers(s)
    s = ex.value
    refs = ex.refs || undefined
  }
  if (config.stripNonAlnum) {
    s = s.replace(/[^0-9a-zA-Z]/g, '')
  }
  if (config.autoNumeric) {
    s = cleanNumericString(s)
  }

  return { value: s, refs }
}


