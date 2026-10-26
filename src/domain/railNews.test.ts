import { describe, expect, it } from 'vitest'
import { fromMetroFile } from '../data/metroFile'
import type { Announcement } from './announcement'
import type { MetroFile } from './metroFile'
import { isRailAnnouncement, railNews, stationsNamed } from './railNews'

// Real titles and openings from oasa.gr (Oct 2026), shortened
const post = (id: number, title: string, body: string, day = 20): Announcement => ({
  id,
  publishedAt: Date.UTC(2026, 9, day, 9),
  updatedAt: Date.UTC(2026, 9, day, 9),
  title,
  summary: '',
  html: `<p>${body}</p>`,
  url: `https://www.oasa.gr/?p=${id}`,
})

const closed = post(
  14870,
  'Κλειστός ο σταθμός “Πανεπιστήμιο” , Τετάρτη 21/10/2026',
  'ο ΟΑΣΑ ανακοινώνει ότι, με εντολή της ΕΛ.ΑΣ.,είναι κλειστός ο σταθμός του μετρό “Πανεπιστήμιο”. Οι συρμοί θα διέρχονται από τον συγκεκριμένο σταθμό χωρίς να πραγματοποιούν στάση.',
  21,
)
const reopened = post(14884, 'Νεότερη ενημέρωση- Άνοιξε ο σταθμός “Πανεπιστήμιο” , Τετάρτη 21/10/2026', 'Σας ενημερώνουμε, πως με εντολή της ΕΛ.ΑΣ, ο σταθμός μετρό «Πανεπιστήμιο» έχει ανοίξει.', 21)
const replacementBus = post(
  14872,
  'Ίδρυση προσωρινής λεωφορειακής γραμμής  Χ25  ΣΤ. ΜΕΤΡΟ ΚΑΤΕΧΑΚΗ -ΣΤ. ΜΕΤΡΟ ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ',
  'την ίδρυση της προσωρινής λεωφορειακής γραμμής με ονομασία Χ25 «ΣΤ.ΜΕΤΡΟ ΚΑΤΕΧΑΚΗ – ΣΤ.ΜΕΤΡΟ ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ», από 25/10/2026 έως και 05/11/2026 για τις ώρες από 21 :40 έως το πέρας της λειτουργίας του Μετρό.',
  24,
)
const tramDiversion = post(
  14606,
  'Μερική προσωρινή τροποποίηση των διαδρομών των γραμμών λεωφορείων, τρόλεϊ και τραμ στο Δήμο Αθηναίων',
  'της διαδρομής των λεωφορειακών γραμμών, γραμμών τρόλεϊ και τραμ την Κυριακή 04/10/2026.',
  3,
)
// Bus detours that only name stations as places
const busAtStation = post(
  14698,
  'Μερική προσωρινή τροποποίηση των λεωφορειακών γραμμών 101, 122, 140, 142 και Β1 στον Δήμο Αργυρούπολης – Ελληνικού',
  'από τον παράδρομο της λεωφόρου Βουλιαγμένης, προσωρινή Αφετηρία στο σταθμό μετρό Αργυρούπολη.',
)
const busToProastiakos = post(
  14802,
  'Μερική προσωρινή τροποποίηση της λεωφορειακής γραμμής 870 στον Δήμο Μεγαρέων',
  'της διαδρομής της λεωφορειακής γραμμής 870 στην κατεύθυνση προς Προαστιακό Μεγάρων, από 19/10/2026.',
)
const busOnFriday = post(14900, 'Μερική τροποποίηση της γραμμής 409 την Παρασκευή 30/10', 'λόγω εργασιών στην Αγίας Παρασκευής.')

// A few real stations: names as the app has them
const file: MetroFile = {
  version: 3,
  firstDate: '2026-10-21',
  lastDate: '2026-10-21',
  lines: [
    { id: 'M3', mode: 'metro', color: '#10069f', textColor: '#ffffff', stations: [0, 1, 2, 3], tracks: [{ path: [[23.7, 37.9], [23.8, 38.0]], stops: [] }] },
    { id: 'T6', mode: 'tram', color: '#00796b', textColor: '#ffffff', stations: [4], tracks: [{ path: [[23.7, 37.9], [23.8, 38.0]], stops: [] }] },
    { id: 'A1', mode: 'suburban', color: '#ffcd00', textColor: '#1a1a1a', stations: [5], tracks: [{ path: [[23.7, 37.9], [23.8, 38.0]], stops: [] }] },
  ],
  stations: [
    ['panepistimio', 'Πανεπιστήμιο', 'Panepistimio', 37.98, 23.73],
    ['katehaki', 'Κατεχάκη', 'Katehaki', 37.99, 23.77],
    ['doukissis-plakentias', 'Δουκίσσης Πλακεντίας', 'Doukissis Plakentias', 38.02, 23.83],
    ['agia-paraskevi', 'Αγία Παρασκευή', 'Agia Paraskevi', 38.01, 23.81],
    ['tram-syntagma', 'Σύνταγμα', 'Syntagma', 37.97, 23.73],
    ['proastiakos-doukissis-plakentias', 'Δουκίσσης Πλακεντίας', 'Doukissis Plakentias', 38.02, 23.83, 17],
  ],
  patterns: [],
  plans: [[]],
  days: { '2026-10-21': 0 },
}
const network = fromMetroFile(file)
const ids = (stations: number[]) => stations.map((s) => network.stations[s].id)

describe('isRailAnnouncement', () => {
  it('finds station closures, replacement buses and tram diversions', () => {
    expect([closed, reopened, replacementBus, tramDiversion].map(isRailAnnouncement)).toEqual([true, true, true, true])
  })

  it('leaves out bus detours that only pass a station', () => {
    expect([busAtStation, busToProastiakos, busOnFriday].map(isRailAnnouncement)).toEqual([false, false, false])
  })
})

describe('stationsNamed', () => {
  it('matches declined and abbreviated names, of the modes the announcement is about', () => {
    expect(ids(stationsNamed(closed, network))).toEqual(['panepistimio'])
    // ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ: the metro station, not the Proastiakos's, since it's about the metro
    expect(ids(stationsNamed(replacementBus, network))).toEqual(['katehaki', 'doukissis-plakentias'])
  })

  it('needs every word of a name', () => {
    expect(stationsNamed(busOnFriday, network)).toEqual([])
  })
})

describe('railNews', () => {
  it('keeps recent rail announcements, newest first', () => {
    const since = Date.UTC(2026, 9, 10)
    const news = railNews([tramDiversion, closed, busAtStation, replacementBus], network, since)
    expect(news.map((n) => n.announcement.id)).toEqual([14872, 14870])
    expect(ids(news[1].stations)).toEqual(['panepistimio'])
  })
})
