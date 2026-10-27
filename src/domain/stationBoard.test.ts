import { describe, expect, it } from 'vitest'
import { isLongDistance, type BoardTrain } from './stationBoard'

const PROASTIAKOS = ['Πειραιάς', 'Ρέντη', 'Αθήνα (Σταθμός Λαρίσης)', 'Άνω Λιόσια', 'Αεροδρόμιο', 'Κιάτο', 'Χαλκίδα']

const train = (origin: string, destination: string): BoardTrain => ({
  train: '1',
  operator: 'HELLENIC TRAIN',
  origin,
  originEn: '',
  destination,
  destinationEn: '',
  platform: null,
  scheduled: 0,
  delayMinutes: 0,
  terminates: false,
  cancelled: false,
  remark: null,
})

describe('isLongDistance', () => {
  it('is true when either end is off the Proastiakos', () => {
    expect(isLongDistance(train('Αθήνα', 'Θεσσαλονίκη Επιβατικός'), PROASTIAKOS)).toBe(true)
    expect(isLongDistance(train('Θεσσαλονίκη Επιβατικός', 'Αθήνα'), PROASTIAKOS)).toBe(true)
  })

  it('matches OSE’s names to the Proastiakos stations despite small differences', () => {
    expect(isLongDistance(train('Ρέντης', 'Αεροδρόμιο'), PROASTIAKOS)).toBe(false)
    expect(isLongDistance(train('ΠΕΙΡΑΙΑΣ', 'Κιάτο'), PROASTIAKOS)).toBe(false)
    expect(isLongDistance(train('Αθήνα', 'Χαλκίδα'), PROASTIAKOS)).toBe(false)
  })

  it('doesn’t tag a train by an end it can’t read', () => {
    expect(isLongDistance(train('', 'Αεροδρόμιο'), PROASTIAKOS)).toBe(false)
  })
})
