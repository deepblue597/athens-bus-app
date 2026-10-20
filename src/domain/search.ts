import type { Line } from './line'

// Line numbers use Greek capitals (Β1, Α7, Χ14) that look like Latin ones people type instead
const LATIN_TO_GREEK: Record<string, string> = {
  A: 'Α', B: 'Β', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ',
}

/** Case- and accent-insensitive form: "Πειραιάς" → "ΠΕΙΡΑΙΑΣ" */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase('el').trim()
}

/** Comparable form of a line number: "b1" → "Β1" */
function lineIdKey(id: string): string {
  return [...normalizeText(id)].map((c) => LATIN_TO_GREEK[c] ?? c).join('')
}

/** "40" and "040" → "40" */
const withoutLeadingZeros = (id: string) => id.replace(/^0+(?=\d)/, '')

// Greek → Latin by sound, digraphs first, so Greek names and Greeklish queries meet in the middle
const GREEK_SOUNDS: [RegExp, string][] = [
  [/ΟΥ/g, 'U'], [/[ΕΟ]Ι/g, 'I'], [/ΑΙ/g, 'E'], [/Γ[ΚΓ]/g, 'G'], [/ΑΥ/g, 'AV'], [/ΕΥ/g, 'EV'],
  [/Θ/g, 'TH'], [/Ψ/g, 'PS'], [/Ξ/g, 'KS'], [/Χ/g, 'H'], [/[ΗΙΥ]/g, 'I'], [/[ΟΩ]/g, 'O'],
]
const GREEK_LETTERS: Record<string, string> = {
  Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Π: 'P', Ρ: 'R', Σ: 'S', Τ: 'T', Φ: 'F',
}
// The same variations in Latin spellings, OASA's own included: "SYNTAGMA"/"SINTAGMA",
// "XALANDRI"/"CHALANDRI", "MOYSEIO", "GKIZI", "Kifissia"
const LATIN_SOUNDS: [RegExp, string][] = [
  [/O[UY]/g, 'U'], [/[EO]I/g, 'I'], [/AI/g, 'E'], [/G[KG]/g, 'G'], [/PH/g, 'F'], [/[CK]H/g, 'H'], [/X/g, 'H'],
  [/C/g, 'K'], [/Y/g, 'I'], [/W/g, 'O'], [/(.)\1+/g, '$1'],
]

/**
 * Loose Latin form for matching place names however they are spelled:
 * "ΣΥΝΤΑΓΜΑ", "SYNTAGMA" and "sintagma" → "SINTAGMA"; "ΚΗΦΙΣΙΑ" and "Kifissia" → "KIFISIA".
 */
export function soundKey(text: string): string {
  // Dots go too, so "Ο.Α.Κ.Α." matches "oaka"
  let key = normalizeText(text).replace(/\./g, '')
  for (const [pattern, latin] of GREEK_SOUNDS) {
    key = key.replace(pattern, latin)
  }
  key = [...key].map((c) => GREEK_LETTERS[c] ?? c).join('')
  for (const [pattern, latin] of LATIN_SOUNDS) {
    key = key.replace(pattern, latin)
  }
  return key
}

// Places people search for by a name OASA doesn't use: the airport is "ΑΕΡΟΛ. ΑΘΗΝΩΝ" or
// "ΑΕΡ/ΝΑΣ ΑΘΗΝΩΝ" (only some lines say "ΑΕΡΟΛΙΜΕΝΑΣ"), Piraeus is "PEIRAIAS"
const ALIASES: { names: string[]; search: string[] }[] = [
  { names: ['AIRPORT', 'ΑΕΡΟΔΡΟΜΙΟ', 'ΑΕΡΟΛΙΜΕΝΑΣ'], search: ['ΑΕΡΟΛ', 'ΑΕΡ/ΝΑΣ'] },
  { names: ['PIRAEUS'], search: ['ΠΕΙΡΑΙΑ'] },
]

/** The query plus what it is an alias for, once it is long enough to tell ("airp" → airport) */
function nameQueries(query: string): string[] {
  const q = normalizeText(query)
  if (q.length < 4) {
    return [q]
  }
  return [q, ...ALIASES.filter((a) => a.names.some((n) => n.startsWith(q))).flatMap((a) => a.search)]
}

// "021" and "21" are different lines that compare equal as numbers, so keep each one's variants with it
const byLineNumber = (a: Line, b: Line) =>
  a.id.localeCompare(b.id, 'el', { numeric: true }) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
  Number(a.isVariant) - Number(b.isVariant)

/**
 * Lines whose number matches exactly come first (then the same number with or without leading
 * zeros), then numbers starting with the query, then lines
 * whose Greek or English name contains it, then names that only match when spelled loosely
 * (Greeklish). Each group is in line-number order, with main lines before their part-route variants.
 */
export function searchLines(lines: Line[], query: string): Line[] {
  if (!normalizeText(query)) {
    return [...lines].sort(byLineNumber)
  }
  const idQuery = lineIdKey(query)
  const idQueryNoZeros = withoutLeadingZeros(idQuery)
  const queries = nameQueries(query)
  const loose = queries.map(soundKey).filter((k) => k.length >= 3)
  const scored: { line: Line; score: number }[] = []
  for (const line of lines) {
    const id = lineIdKey(line.id)
    const idNoZeros = withoutLeadingZeros(id)
    const names = [line.name, line.nameEn ?? '']
    // "21" is trolley 21 before bus 021, "021" the other way round; "0" already lists 0xx lines
    const score =
      id === idQuery
        ? 0
        : idNoZeros === idQueryNoZeros
          ? 0.5
          : id.startsWith(idQuery) || idNoZeros.startsWith(idQueryNoZeros)
            ? 1
            : names.some((n) => queries.some((q) => normalizeText(n).includes(q)))
              ? 2
              : names.some((n) => loose.some((q) => soundKey(n).includes(q)))
                ? 3
                : -1
    if (score >= 0) {
      scored.push({ line, score })
    }
  }
  return scored.sort((a, b) => a.score - b.score || byLineNumber(a.line, b.line)).map((s) => s.line)
}
