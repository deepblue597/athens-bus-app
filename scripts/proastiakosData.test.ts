import { describe, expect, it } from 'vitest'
import { clockText, parseClock, parseTimetableText, timetablePdfs, weekdayOnlyTrains } from './proastiakosData.ts'

// Excerpts of `pdftotext -layout` output from Hellenic Train's PDFs (Oct 2026), shortened
const A1 = `
                                        Τα Δρομολόγια 3201 & 3204 ΔΕΝ κυκλοφορούν
                                                Σαββατοκύριακα και αργίες.


                                                ΠΕΙΡΑΙΑΣ - ΑΘΗΝΑ - ΑΕΡΟΔΡΟΜΙΟ
                                              Αριθμός
                                            Δρομολογίου
                                                          3200 3204*  1202


Πειραιάς/Piraeus                                           ...   ...    5:43
Ρέντη/Renti (A.I.R.)                                       ...   ...    5:51
Ταύρος/Tavros                                             4:03   5:05   5:54
Πύργος Βασιλίσσης/Pyrgos
                                                          4:22   5:24   6:13
Vasilissis
Αεροδρόμιο/Athens Airport (AIA)                           4:58   6:00   6:49


                                                ΑΕΡΟΔΡΟΜΙΟ - ΑΘΗΝΑ - ΠΕΙΡΑΙΑΣ
                                              Αριθμός
                                            Δρομολογίου
                                                          3201*   1239


Αεροδρόμιο/Athens Airport (AIA)                           22:11   23:32
Μεταμόρφωση/Metamorfosi                                   22:40   0:01
Ταύρος/Tavros                                             23:10   0:25
Πειραιάς/Piraeus                                           ...     ...
`

const A2_WEEKENDS = `
                                    ΑΝΩ ΛΙΟΣΙΑ - ΑΕΡΟΔΡΟΜΙΟ (Σάββατο, Κυριακή & αργίες)
                                     (Ano Liosia - Airport Suturday, Sunday,holidays )
                                              Αριθμός
                                            Δρομολογίου
                                                          4202 4204


Άνω Λιόσια/Ano Liosia                                     5:43   6:43
ΣΚΑ Προαστιακού/SKA Suburban                              5:46   6:46
Αεροδρόμιο/Athens Airport (AIA)                           6:16   7:16
`

const A3 = `
                                ΤΑ ΔΡΟΜΟΛΟΓΙΑ ΜΕ ΑΡΙΘΜΟ 3530 & 3533
                                ΔΕΝ ΚΥΚΛΟΦΟΡΟΥΝ ΣΑΒΒΑΤΟ ΚΥΡΙΑΚΕΣ & ΑΡΓΙΕΣ

                                   ΑΘΗΝΑ (Athens) - ΧΑΛΚΙΔΑ (Chalkida)

                                                       Αριθμός
                                                     Δρομολογίου
                                                                   11530 3530     1532
Αθήνα/Athens                                                        ...    4:28   5:28
Αφίδναι/Afidnai                                                     ...    4:59   6:01

Σφενδάλη/Sfendali                                                   ...    5:08   6:10
Οινόη/Oinoi
(Σύνδεση με γραμμή δρομολογίων εθνικού δικτύου/                     4:30   5:27   6:29
Connection with line of national railway station )
Δήλεσι/Dilesi                                                        |     5:30   6:32
Αυλίδα/Avlida                                                       4.41   5:39   6:42

Χαλκίδα/Chalkida                                                    4.51   5:52   6:52



                                   ΧΑΛΚΙΔΑ (Chalkida) - ΑΘΗΝΑ (Athens)
                                                       Αριθμός
                                                     Δρομολογίου
                                                                   3533    2539
Χαλκίδα/Chalkida                                                    5:58   0:00

Αυλίδα/Avlida                                                       6:09   0:11
Οινόη/Oinoi
(Σύνδεση με γραμμή δρομολογίων εθνικού δικτύου/                     6:22   0:23
Connection with line of national railway station)
Αθήνα/Athens                                                        7:21    ...
`

describe('parseTimetableText', () => {
  const trips = parseTimetableText(A1, 'A1')
  const train = (number: string, list = trips) => list.find((t) => t.train === number)!

  it('reads each column as a trip, skipping stations a train doesn’t run to', () => {
    expect(trips.map((t) => t.train)).toEqual(['3200', '3204', '1202', '3201', '1239'])
    expect(train('3200')).toEqual({
      line: 'A1',
      train: '3200',
      days: 'daily',
      stops: [
        ['Ταύρος', '4:03'],
        ['Πύργος Βασιλίσσης', '4:22'],
        ['Αεροδρόμιο', '4:58'],
      ],
    })
    expect(train('1202').stops[0]).toEqual(['Πειραιάς', '5:43'])
  })

  it('reads the times of a name that wraps over two lines', () => {
    expect(train('1202').stops.find(([name]) => name === 'Πύργος Βασιλίσσης')).toEqual(['Πύργος Βασιλίσσης', '6:13'])
  })

  it('keeps counting hours past midnight within a trip', () => {
    expect(train('1239').stops).toEqual([
      ['Αεροδρόμιο', '23:32'],
      ['Μεταμόρφωση', '24:01'],
      ['Ταύρος', '24:25'],
    ])
  })

  it('runs trains a note leaves out at weekends on weekdays only', () => {
    expect(train('3204').days).toBe('weekdays')
    expect(train('3201').days).toBe('weekdays')
    expect(train('3200').days).toBe('daily')
  })

  it('takes a table’s days from its title', () => {
    const weekend = parseTimetableText(A2_WEEKENDS, 'A2')
    expect(weekend.map((t) => [t.train, t.days])).toEqual([
      ['4202', 'weekends'],
      ['4204', 'weekends'],
    ])
    expect(weekend[0].stops[1]).toEqual(['ΣΚΑ Προαστιακού', '5:46'])
    const weekdays = parseTimetableText(A2_WEEKENDS.replace('(Σάββατο, Κυριακή & αργίες)', '(Δευτέρα έως Παρασκευή)'), 'A2')
    expect(weekdays[0].days).toBe('weekdays')
  })

  it('skips stations passed without stopping, reads 4.41 and the note under a name', () => {
    const a3 = parseTimetableText(A3, 'A3')
    expect(train('11530', a3).stops).toEqual([
      ['Οινόη', '4:30'],
      ['Αυλίδα', '4:41'],
      ['Χαλκίδα', '4:51'],
    ])
    expect(train('3530', a3).days).toBe('weekdays')
    expect(train('3533', a3).days).toBe('weekdays')
    expect(train('1532', a3).days).toBe('daily')
  })

  it('puts a trip leaving just after midnight at the end of the service day', () => {
    const a3 = parseTimetableText(A3, 'A3')
    expect(train('2539', a3).stops).toEqual([
      ['Χαλκίδα', '24:00'],
      ['Αυλίδα', '24:11'],
      ['Οινόη', '24:23'],
    ])
  })

  it('fails on a row with the wrong number of times', () => {
    expect(() => parseTimetableText(A1.replace('4:03   5:05   5:54', '4:03   5:54'), 'A1')).toThrow('Ταύρος): 2 times for 3 trains')
  })

  it('fails on a train marked * that no note explains', () => {
    expect(() => parseTimetableText(A1.replace('3201 & 3204', '3201'), 'A1')).toThrow('Train 3204 is marked *')
  })
})

describe('weekdayOnlyTrains', () => {
  it('reads notes over several lines, in either case, with or without accents', () => {
    expect([...weekdayOnlyTrains(A1)]).toEqual(['3201', '3204'])
    expect([...weekdayOnlyTrains(A3)]).toEqual(['3530', '3533'])
  })

  it('fails on a note about other days', () => {
    expect(() => weekdayOnlyTrains('Τα Δρομολόγια 1300 ΔΕΝ κυκλοφορούν τον Αύγουστο.')).toThrow('doesn')
  })
})

describe('timetablePdfs', () => {
  it('lists the page’s PDFs once each', () => {
    const page =
      '<a href="https://www.hellenictrain.gr/wp-content/uploads/2026/05/peiraias-athina-aerodromio.pdf">A1</a>' +
      '<a href="https://www.hellenictrain.gr/wp-content/uploads/2026/05/peiraias-athina-aerodromio.pdf">again</a>' +
      '<a href="https://example.com/other.pdf">elsewhere</a>'
    expect(timetablePdfs(page)).toEqual(['https://www.hellenictrain.gr/wp-content/uploads/2026/05/peiraias-athina-aerodromio.pdf'])
  })
})

describe('clock times', () => {
  it('round-trips hours past midnight', () => {
    expect(clockText(parseClock('24:17'))).toBe('24:17')
    expect(parseClock('4:03')).toBe(4 * 3600 + 3 * 60)
    expect(() => parseClock('4.03')).toThrow('Bad time')
  })
})
