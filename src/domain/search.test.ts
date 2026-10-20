import { describe, expect, it } from 'vitest'
import type { Line } from './line'
import { normalizeText, searchLines, soundKey } from './search'

const line = (code: string, id: string, name: string, nameEn: string, isVariant = false): Line => ({
  code,
  id,
  masterCode: '1',
  name,
  nameEn,
  isVariant,
})

// Names as webGetLinesWithMLInfo spells them (English ones are inconsistent: SINTAGMA, XALANDRI)
const lines = [
  line('938', '040', 'ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ', 'PEIRAIAS - SINTAGMA'),
  line('871', 'Β1', 'ΠΕΙΡΑΙΑΣ - ΑΝΩ ΓΛΥΦΑΔΑ', 'PEIRAIAS - ANO GLYFADA'),
  line('1693', '400', 'ΠΕΙΡΑΙΑΣ -  ΣΤ. ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ (ΝΥΧΤΕΡΙΝΗ)', 'PEIRAIAS - ST. DOUK. PLAKENTIAS (NIGHT LINE)'),
  line('1663', 'Α7', 'ΣΤΟΥΡΝΑΡΗ - ΚΗΦΙΣΙΑ (ΠΛΑΤΕΙΑ ΠΛΑΤΑΝΟΥ) (ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ)', 'STOYRNARI - KIFISIA (FROM 1st KRYONERIOY)', true),
  line('965', 'Α7', 'ΣΤΟΥΡΝΑΡΗ - ΚΗΦΙΣΙΑ (ΠΛΑΤΕΙΑ ΠΛΑΤΑΝΟΥ)', 'STOYRNARI - KIFISIA (PLATEIA PLATANOU)'),
  line('1082', '21', 'ΝΙΚΑΙΑ - Π. ΡΑΛΛΗ - ΟΜΟΝΟΙΑ (ΚΥΚΛΙΚΗ)', 'NIKAIA - P. RALLI - OMONOIA'),
  line('1151', '021', 'ΠΛΑΤΕΙΑ ΚΑΝΙΓΓΟΣ - ΓΚΥΖH (ΚΥΚΛΙΚΗ)', 'PLATEIA KANIGKOS - GKIZI'),
  line('1077', '10', 'ΤΖΙΤΖΙΦΙΕΣ - ΧΑΛΑΝΔΡΙ', 'TZITZIFIES - XALANDRI'),
  line('1025', 'Χ95', 'ΣΥΝΤΑΓΜΑ - ΑΕΡΟΛ. ΑΘΗΝΩΝ (EXPRESS)', 'SYNTAGMA - AEROL. ATHINON (EXPRESS)'),
  line('892', 'Χ96', 'ΠΕΙΡΑΙΑΣ - ΑΕΡ/ΝΑΣ ΑΘΗΝΩΝ (EXPRESS)', 'PEIRAIAS - AER/NAS ATHINON (EXPRESS)'),
  line('1547', 'Χ97', 'ΑΕΡΟΛΙΜΕΝΑΣ ΑΘΗΝΩΝ - ΣΤ. ΕΛΛΗΝΙΚΟ (EXPRESS) (ΚΥΚΛΙΚΗ)', 'ATHENS AIRPORT - ST. ELLINIKO'),
  line('1383', 'Ε14', 'ΣΥΝΤΑΓΜΑ - Ο.Α.Κ.Α. - ΥΠ. ΠΑΙΔΕΙΑΣ (EXPRESS)', 'SYNTAGMA - O.A.K.A. - YP. PAIDEIAS (EXPRESS)'),
]

const ids = (query: string) => searchLines(lines, query).map((l) => l.id)
const codes = (query: string) => searchLines(lines, query).map((l) => l.code)

describe('normalizeText', () => {
  it('ignores accents and case', () => {
    expect(normalizeText('Πειραιάς')).toBe('ΠΕΙΡΑΙΑΣ')
  })
})

describe('soundKey', () => {
  it('spells Greek and Greeklish names the same way', () => {
    expect(soundKey('ΣΥΝΤΑΓΜΑ')).toBe(soundKey('syntagma'))
    expect(soundKey('ΣΥΝΤΑΓΜΑ')).toBe(soundKey('SINTAGMA'))
    expect(soundKey('ΚΗΦΙΣΙΑ')).toBe(soundKey('Kifissia'))
    expect(soundKey('ΧΑΛΑΝΔΡΙ')).toBe(soundKey('XALANDRI'))
    expect(soundKey('ΓΚΥΖΗ')).toBe(soundKey('Gyzi'))
    expect(soundKey('ΠΕΙΡΑΙΑΣ')).toBe(soundKey('PEIRAIAS'))
  })
})

describe('searchLines', () => {
  it('finds a line number without its leading zero, exact match first', () => {
    expect(ids('40')).toEqual(['040', '400'])
  })

  it('puts the number as typed before the same number with a leading zero', () => {
    expect(ids('21')).toEqual(['21', '021'])
    expect(ids('021')).toEqual(['021', '21'])
  })

  it('lists 0xx lines while a leading zero is typed', () => {
    expect(ids('0')).toEqual(['021', '040'])
  })

  it('accepts Latin letters for Greek line numbers', () => {
    expect(ids('b1')).toEqual(['Β1'])
    expect(ids('x95')).toEqual(['Χ95'])
    expect(ids('e14')).toEqual(['Ε14'])
  })

  it('lists a main line before its part-route variants', () => {
    expect(codes('a7')).toEqual(['965', '1663'])
  })

  it('searches Greek names without accents', () => {
    expect(ids('κηφισιά')).toEqual(['Α7', 'Α7'])
  })

  it('searches English names', () => {
    expect(ids('glyfada')).toEqual(['Β1'])
  })

  it('matches Greeklish spellings OASA doesn’t use', () => {
    expect(ids('syntagma')).toEqual(['Ε14', 'Χ95', '040'])
    expect(ids('kifissia')).toEqual(['Α7', 'Α7'])
    expect(ids('chalandri')).toEqual(['10'])
    expect(ids('oaka')).toEqual(['Ε14'])
  })

  it('finds the airport by its everyday name', () => {
    expect(ids('airport')).toEqual(['Χ95', 'Χ96', 'Χ97'])
    expect(ids('αεροδρόμιο')).toEqual(['Χ95', 'Χ96', 'Χ97'])
  })

  it('lists every line, in line-number order, for an empty query', () => {
    expect(ids('')).toEqual(['10', '021', '21', '040', '400', 'Α7', 'Α7', 'Β1', 'Ε14', 'Χ95', 'Χ96', 'Χ97'])
  })
})
