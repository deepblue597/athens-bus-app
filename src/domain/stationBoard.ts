/** A train on a Proastiakos station's live departures board, run by OSE (Hellenic Railways) */
export interface BoardTrain {
  /** Train number, e.g. "1200": the same as in Hellenic Train's timetables */
  train: string
  /** "HELLENIC TRAIN": other operators' trains could appear too */
  operator: string
  /** Where the train's journey starts and ends, in Greek and English ("Ρέντης", "Αεροδρόμιο") */
  origin: string
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
