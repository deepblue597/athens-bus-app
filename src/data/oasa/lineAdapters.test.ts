import { describe, expect, it } from 'vitest'
import type { ILineWithMLInfo, IRoute } from 'oasa-telematics-api'
import { scheduleDayLabel, startingPoint, toLineDirections, toLines, toScheduleDays, toTimetable } from './lineAdapters'
import { OasaApiError } from './adapters'

function route(RouteCode: string, RouteType: string, RouteDescr: string): IRoute {
  return { RouteCode, LineCode: '938', RouteDescr, RouteDescrEng: RouteDescr, RouteType, RouteDistance: '10000' }
}

describe('toLines', () => {
  it('marks part-route variants', () => {
    // webGetLinesWithMLInfo, 2026-10-20
    const raw: ILineWithMLInfo[] = [
      { ml_code: '129', sdc_code: '54', line_code: '965', line_id: 'Α7', line_descr: 'ΣΤΟΥΡΝΑΡΗ - ΚΗΦΙΣΙΑ (ΠΛΑΤΕΙΑ ΠΛΑΤΑΝΟΥ)', line_descr_eng: 'STOYRNARI - KIFISIA (PLATEIA PLATANOU)', mld_master: '1' },
      { ml_code: '129', sdc_code: '54', line_code: '1663', line_id: 'Α7', line_descr: 'ΣΤΟΥΡΝΑΡΗ - ΚΗΦΙΣΙΑ (ΠΛΑΤΕΙΑ ΠΛΑΤΑΝΟΥ) (ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ)', line_descr_eng: '', mld_master: '0' },
    ]
    expect(toLines(raw).map((l) => [l.code, l.isVariant, l.nameEn])).toEqual([
      ['965', false, 'STOYRNARI - KIFISIA (PLATEIA PLATANOU)'],
      ['1663', true, null],
    ])
  })

  it('trims line numbers', () => {
    // Line 14 is "14 " in webGetLinesWithMLInfo, webGetLines and webRoutesForStop (2026-10-20)
    const raw = [{ ml_code: '20', sdc_code: '54', line_code: '1078', line_id: '14 ', line_descr: 'ΛΑΜΠΡΙΝΗ - Λ. ΑΛΕΞΑΝΔΡΑΣ - ΓΗΡΟΚΟΜΕΙΟ', line_descr_eng: '', mld_master: '1' }]
    expect(toLines(raw)[0].id).toBe('14')
  })
})

describe('toLineDirections', () => {
  // webGetRoutes&p1=938 (line 040), 2026-10-20
  const routes = [
    route('3922', '1', 'ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ'),
    route('3923', '2', 'ΣΥΝΤΑΓΜΑ - ΠΕΙΡΑΙΑΣ'),
    route('3924', '1', 'ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ [22:00-06:00]'),
  ]

  it('groups routes by direction, with the main route first', () => {
    const directions = toLineDirections(routes)
    expect(directions.map((d) => [d.type, d.routeCode, d.from])).toEqual([
      ['1', '3922', 'ΠΕΙΡΑΙΑΣ'],
      ['2', '3923', 'ΣΥΝΤΑΓΜΑ'],
    ])
  })

  it('keeps alternative routes as variants', () => {
    expect(toLineDirections(routes)[0].variants).toEqual([{ routeCode: '3924', name: 'ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ [22:00-06:00]' }])
  })

  it('picks the route with the fewest notes when every route has one', () => {
    // webGetRoutes&p1=877 (night line 500): all routes are marked [ΝΥΧΤΕΡΙΝΗ]
    const directions = toLineDirections([
      route('2900', '2', 'ΚΗΦΙΣΙΑ - ΠΕΙΡΑΙΑΣ [ΝΥΧΤΕΡΙΝΗ] [ΣΑΒΒΑΤΟ-ΚΥΡΙΑΚΗ]'),
      route('1889', '2', 'ΚΗΦΙΣΙΑ - ΠΕΙΡΑΙΑΣ [ΝΥΧΤΕΡΙΝΗ]'),
      route('2783', '1', 'ΠΕΙΡΑΙΑΣ - ΚΗΦΙΣΙΑ [ΝΥΧΤΕΡΙΝΗ] [ΣΑΒΒΑΤΟ-ΚΥΡΙΑΚΗ]'),
      route('1890', '1', 'ΠΕΙΡΑΙΑΣ - ΚΗΦΙΣΙΑ [ΝΥΧΤΕΡΙΝΗ]'),
    ])
    expect(directions.map((d) => [d.type, d.routeCode, d.from])).toEqual([
      ['1', '1890', 'ΠΕΙΡΑΙΑΣ'],
      ['2', '1889', 'ΚΗΦΙΣΙΑ'],
    ])
  })

  it('handles a line with no routes', () => {
    expect(toLineDirections(null)).toEqual([])
  })
})

describe('startingPoint', () => {
  // Route names from webGetRoutes, 2026-10-20
  it.each([
    ['ΠΕΙΡΑΙΑΣ -  ΣΤ. ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ [ΝΥΧΤΕΡΙΝΗ] ', 'ΠΕΙΡΑΙΑΣ'],
    ['ΣΤ.ΔΟΥΚ.ΠΛΑΚΕΝΤΙΑΣ- Ν. ΖΩH-ΣΤ.ΝΟΜΙΣΜΑΤΟΚΟΠΕΙΟ', 'ΣΤ.ΔΟΥΚ.ΠΛΑΚΕΝΤΙΑΣ'],
    ['ΠΕΡΙΣΤΕΡΙ [ΑΓ. ΙΕΡΟΘΕΟΣ] - ΖΑΠΠΕΙΟ', 'ΠΕΡΙΣΤΕΡΙ (ΑΓ. ΙΕΡΟΘΕΟΣ)'],
    ['ΠΕΙΡΑΙΑΣ - ΑΕΡ/ΝΑΣ ΑΘΗΝΩΝ [EXPRESS]-[20:00-04:30 ΑΠΟ ΠΛ.ΚΑΡΑΪΣΚΑΚΗ]', 'ΠΕΙΡΑΙΑΣ'],
    ['ΒΟΥΛΑ - ΠΕΙΡΑΙΑΣ [ΑΠΟ ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ ΕΩΣ ΠΕΙΡΑΙΑ]', 'ΕΚΚΛΗΣΙΑ ΒΑΡΗΣ'],
    ['ΚΗΦΙΣΙΑ - ΣΤΟΥΡΝΑΡΗ [ΑΠΟ ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ]', 'ΣΤΑΣΗ 1η ΚΡΥΟΝΕΡΙΟΥ'],
    ['ΤΟΠΙΚΗ ΚΑΜΑΤΕΡΟΥ [ΣΧΟΛΙΚΗ] [ΑΠΟ ΔΗΜΑΡΧΕΙΟ ΚΑΜΑΤΕΡΟΥ]', 'ΔΗΜΑΡΧΕΙΟ ΚΑΜΑΤΕΡΟΥ'],
    ['ΤΟΠΙΚΗ ΗΡΑΚΛΕΙΟΥ [Εναλλακτική λόγω λαϊκής & έργων κάθε Τετάρτη 06:00-17:00]', 'ΤΟΠΙΚΗ ΗΡΑΚΛΕΙΟΥ'],
  ])('%s → %s', (name, from) => {
    expect(startingPoint(name)).toBe(from)
  })
})

describe('toScheduleDays', () => {
  it('adds short labels for every day type OASA uses', () => {
    // getScheduleDaysMasterline for lines 040, Χ96, Χ95 and Χ20, 2026-10-20
    const days = toScheduleDays([
      { sdc_descr: 'ΧΕΙΜΕΡΙΝΟ ΚΑΘΗΜΕΡΙΝΗ', sdc_descr_eng: 'WINTER DAILY', sdc_code: '54' },
      { sdc_descr: 'ΧΕΙΜΕΡΙΝΟ ΣΑΒΒΑΤΟ', sdc_descr_eng: 'WINTER SATURDAY', sdc_code: '59' },
      { sdc_descr: 'ΧΕΙΜΕΡΙΝO ΚΥΡΙΑΚΗ', sdc_descr_eng: 'WINTER SUNDAY', sdc_code: '60' },
      { sdc_descr: 'ΧΕΙΜΕΡΙΝΟ ΣΑΒΒΑΤΟ, ΚΥΡΙΑΚΗ', sdc_descr_eng: 'WINTER SATURDAY, SUNDAY', sdc_code: '68' },
      { sdc_descr: 'ΧΕΙΜΕΡΙΝΟ ΟΛΕΣ', sdc_descr_eng: 'WINTER ALL DAYS', sdc_code: '81' },
      { sdc_descr: 'ΧΕΙΜΕΡΙΝΟ ΔΕΥΤΕΡΑ - ΠΕΜΠΤΗ', sdc_descr_eng: 'WINTER MONDAY TO THURSDAY', sdc_code: '113' },
    ] as never)
    expect(days.map((d) => d.label)).toEqual(['Weekdays', 'Saturday', 'Sunday', 'Weekend', 'Every day', 'Mon–Thu'])
  })

  it('falls back to the name without its season', () => {
    expect(scheduleDayLabel('SUMMER HOLIDAYS')).toBe('Holidays')
  })
})

describe('toTimetable', () => {
  it('takes outbound times from go.sde_start1 and return times from come.sde_start2', () => {
    // Shape from getDailySchedule&line_code=938: go rows are round trips that also carry a return time
    const timetable = toTimetable({
      go: [{ sde_start1: '1900-01-01 04:30:00', sde_start2: '1900-01-01 05:20:00' } as never],
      come: [{ sde_start1: null, sde_start2: '1900-01-01 04:40:00' } as never],
    })
    expect(timetable.outbound.map((t) => t.label)).toEqual(['04:30'])
    expect(timetable.inbound.map((t) => t.label)).toEqual(['04:40'])
  })

  it('ignores the other leg of a row, which can belong to another line', () => {
    // getSchedLines&p1=164&p2=54&p3=1033 (line 217): buses alternate with line 229 (line code 1034)
    const timetable = toTimetable({
      go: [{ sde_line1: '1033', sde_start1: '1900-01-01 05:45:00', sde_line2: '1034', sde_start2: '1900-01-01 06:40:00' } as never],
      come: [{ sde_line1: '1034', sde_start1: '1900-01-01 06:10:00', sde_line2: '1033', sde_start2: '1900-01-01 07:00:00' } as never],
    })
    expect(timetable.outbound.map((t) => t.label)).toEqual(['05:45'])
    expect(timetable.inbound.map((t) => t.label)).toEqual(['07:00'])
  })

  it('ignores legs getDailySchedule flags with kp = "1"', () => {
    // getDailySchedule&line_code=965 (Α7), 2026-10-20: OASA lists these rows on one side only
    const timetable = toTimetable({
      go: [{ sdd_line1: '965', sdd_kp1: '0', sde_start1: '1900-01-01 08:25:00', sdd_line2: '965', sdd_kp2: '1', sde_start2: '1900-01-01 09:35:00' } as never],
      come: [{ sdd_line1: '965', sdd_kp1: '1', sde_start1: '1900-01-01 05:25:00', sdd_line2: '965', sdd_kp2: '0', sde_start2: '1900-01-01 06:15:00' } as never],
    })
    expect(timetable.outbound.map((t) => t.label)).toEqual(['08:25'])
    expect(timetable.inbound.map((t) => t.label)).toEqual(['06:15'])
  })

  it('removes repeated times and sorts after-midnight trips last', () => {
    const timetable = toTimetable({
      go: [
        { sde_start1: '1900-01-01 22:00:00' },
        { sde_start1: '1900-01-02 00:30:00' },
        { sde_start1: '1900-01-01 05:00:00' },
        { sde_start1: '1900-01-01 05:00:00' },
        { sde_start1: null },
      ],
      come: [],
    })
    expect(timetable.outbound.map((t) => t.label)).toEqual(['05:00', '22:00', '00:30'])
  })

  it('throws on an OASA error body', () => {
    expect(() => toTimetable({ error: 'invalid parameters' })).toThrow(OasaApiError)
  })

  it('returns an empty timetable for an unknown line', () => {
    expect(toTimetable({ go: [], come: [] })).toEqual({ outbound: [], inbound: [] })
  })
})
