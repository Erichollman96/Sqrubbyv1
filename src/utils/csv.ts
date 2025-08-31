import Papa from 'papaparse'
import type { ParsedCsvData } from '../types'

export function parseCsv(content: string): ParsedCsvData {
  const result = Papa.parse<string[]>(content, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  })
  if (result.errors && result.errors.length > 0) {
    // Keep it simple for now; in a real app we might surface detailed errors
    console.warn('CSV parse warnings:', result.errors)
  }
  const rows = (result.data as unknown as string[][]).map((r) => r.map((c) => (c == null ? '' : String(c))))
  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = rows[0]
  const dataRows = rows.slice(1)
  return { headers, rows: dataRows }
}



