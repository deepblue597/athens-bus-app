/** A train on a Proastiakos station's live departures board, run by OSE (Hellenic Railways) */
export interface BoardTrain {
  /** Train number, e.g. "1200": the same as in Hellenic Train's timetables */
  train: string
  /** "HELLENIC TRAIN": other operators' trains could appear too */
  operator: string
  /** Where the train's journey starts and ends, in Greek and English ("Ρέντης", "Αεροδρόμιο") */
  origin: string
  originEn: string
  destination: string
  destinationEn: string
  /** Platform, when announced */
  platform: string | null
  /** Scheduled departure (or arrival, for a train ending here), epoch ms */
  scheduled: number
  /** Minutes late as OSE reports them; 0 on time */
  delayMinutes: number
  /** The journey ends at this station: it only arrives */
  terminates: boolean
  /** OSE has cancelled this train ("ΚΑΤΑΡΓΗΣΗ ΔΡΟΜΟΛΟΓΙΟΥ" on the screens) */
  cancelled: boolean
  /** Any other remark the screens add to the route, in Greek, e.g. a remark this app doesn't know yet */
  remark: string | null
}

export interface StationBoard {
  /** The next trains, soonest first, as the station's screens show them (about five) */
  trains: BoardTrain[]
  /** Messages OSE scrolls across the station's screens (disruptions, strikes), in Greek */
  notices: string[]
}

/** When a train should now leave: its scheduled time plus the reported delay */
export function expectedTime(train: BoardTrain): number {
  return train.scheduled + train.delayMinutes * 60_000
}

/**
 * A train that starts or ends off the Proastiakos, e.g. Athens – Thessaloniki. The boards list these too.
 * `proastiakosNames` are the Proastiakos stations' Greek names. OSE's names differ a little
 * ("Ρέντης" for Ρέντη, "Αθήνα" for "Αθήνα (Σταθμός Λαρίσης)"), so a name matches when one starts with the other.
 */
export function isLongDistance(train: BoardTrain, proastiakosNames: readonly string[]): boolean {
  const known = proastiakosNames.map(normalizeName)
  const onProastiakos = (name: string) => {
    const n = normalizeName(name)
    // A name that can't be read isn't evidence of anything
    return n === '' || known.some((k) => k.startsWith(n) || n.startsWith(k))
  }
  return !onProastiakos(train.origin) || !onProastiakos(train.destination)
}

/** "Αθήνα (Σταθμός Λαρίσης)" → "αθηνα": no accents, case or parentheses */
function normalizeName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/\s+/g, ' ')
    .trim()
}
