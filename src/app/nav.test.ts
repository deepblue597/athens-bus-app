import { describe, expect, it } from 'vitest'
import { activeSection, isTabPage, sectionPath } from './nav'

describe('activeSection', () => {
  it('puts Nearby and stop pages under Nearby', () => {
    expect(activeSection('/', null)).toBe('nearby')
    expect(activeSection('/stop/400075', null)).toBe('nearby')
  })

  it('puts the lines list and timetables under Lines', () => {
    expect(activeSection('/lines', null)).toBe('lines')
    expect(activeSection('/line/1151', null)).toBe('lines')
  })

  it('puts the metro map and stations under Metro', () => {
    expect(activeSection('/metro', null)).toBe('metro')
    expect(activeSection('/metro/station/syntagma', null)).toBe('metro')
    expect(activeSection('/metros', null)).toBeNull()
  })

  it('puts announcements under News', () => {
    expect(activeSection('/news', null)).toBe('news')
    expect(activeSection('/news/12345', null)).toBe('news')
  })

  it('puts a route opened from a timetable under Lines', () => {
    expect(activeSection('/route/2045', { fromLine: { code: '1151', id: '040', name: 'x' } })).toBe('lines')
  })

  it('puts a route opened from a stop or a shared link under Nearby', () => {
    expect(activeSection('/route/2045', { fromStopCode: '400075' })).toBe('nearby')
    expect(activeSection('/route/2045', null)).toBe('nearby')
    expect(activeSection('/route/2045', undefined)).toBe('nearby')
  })

  it('leaves pages outside the tabs without one', () => {
    expect(activeSection('/app', null)).toBeNull()
    // "/lines" is a tab but "/linesx" is not
    expect(activeSection('/linesx', null)).toBeNull()
    expect(activeSection('/newsroom', null)).toBeNull()
  })
})

describe('isTabPage', () => {
  it('is true only on the tabs themselves', () => {
    expect(isTabPage('/')).toBe(true)
    expect(isTabPage('/lines')).toBe(true)
    expect(isTabPage('/news')).toBe(true)
    expect(isTabPage('/metro')).toBe(true)
    expect(isTabPage('/metro/station/syntagma')).toBe(false)
    expect(isTabPage('/news/1')).toBe(false)
    expect(isTabPage('/stop/1')).toBe(false)
    expect(isTabPage('/app')).toBe(false)
  })
})

describe('sectionPath', () => {
  it('gives each tab its page', () => {
    expect(sectionPath('nearby')).toBe('/')
    expect(sectionPath('lines')).toBe('/lines')
    expect(sectionPath('metro')).toBe('/metro')
    expect(sectionPath('news')).toBe('/news')
  })
})
