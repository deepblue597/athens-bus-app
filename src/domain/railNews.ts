import type { Announcement } from './announcement'
import type { MetroMode, MetroNetwork } from './metro'

// OASA's announcements (the News tab) are mostly bus detours, but OASA also announces metro station
// closures, the metro's replacement buses and tram diversions. Bus detours name metro stations as
// landmarks all the time ("προσωρινή αφετηρία στον σταθμό μετρό Αργυρούπολη"), so an announcement
// counts as rail news only when it talks about the service itself.

/** An announcement about the metro, tram or Proastiakos, and the stations its title names */
export interface RailNews {
  announcement: Announcement
  /** Station indexes in the network */
  stations: number[]
}

/** Uppercase without accents, so "μετρό", "Μετρό" and "ΜΕΤΡΟ" read the same */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
}

/** \b doesn't work for Greek: a word boundary is anything that isn't a letter */
const word = (pattern: string) => new RegExp(`(?:^|[^\\p{L}])(?:${pattern})(?![\\p{L}])`, 'u')

const RAIL = 'ΜΕΤΡΟ|ΗΣΑΠ|ΗΛΕΚΤΡΙΚΟΥ|ΤΡΑΜ|ΠΡΟΑΣΤΙΑΚΟΥ'

/** Phrases that are about rail service, not a place a bus goes past */
const SERVICE: RegExp[] = [
  // "κλειστός ο σταθμός", "Άνοιξε ο σταθμός", "κλείνουν νωρίτερα σταθμοί"
  word('(?:ΚΛΕΙΣΤ|ΚΛΕΙΝ|ΕΚΛΕΙΣ|ΑΝΟΙΞ|ΑΝΟΙΧΤ|ΑΝΟΙΓ)\\p{L}*(?:\\s+\\p{L}+)?\\s+(?:Ο|ΟΙ|ΤΟ|ΤΑ|ΤΩΝ)?\\s*ΣΤΑΘΜ\\p{L}*'),
  // "Οι συρμοί θα διέρχονται χωρίς στάση"
  word('ΣΥΡΜ(?:ΟΙ|ΩΝ|ΟΣ|ΟΥΣ|ΟΥ)'),
  // "έως το πέρας της λειτουργίας του Μετρό", "διακοπή κυκλοφορίας του τραμ"
  word(`(?:ΛΕΙΤΟΥΡΓΙ|ΚΥΚΛΟΦΟΡΙ|ΔΡΟΜΟΛΟΓΙ|ΔΙΑΚΟΠ)\\p{L}*\\s+(?:ΤΟΥ|ΤΩΝ|ΤΗΣ|ΣΤΟ|ΣΤΗ|ΣΤΗΝ)\\s+(?:${RAIL})`),
  // "στη Γραμμή 3 του Μετρό"
  word('ΓΡΑΜΜΗ?Σ?\\s+[123]\\s+(?:ΤΟΥ\\s+)?ΜΕΤΡΟ'),
]

/** A title about tram routes ("γραμμών λεωφορείων, τρόλεϊ και τραμ") is about the tram's service */
const TRAM_IN_TITLE = word('ΤΡΑΜ')

const MODE_WORDS: Record<MetroMode, RegExp> = {
  metro: word('ΜΕΤΡΟ|ΗΣΑΠ|ΗΛΕΚΤΡΙΚ\\p{L}*'),
  tram: word('ΤΡΑΜ'),
  suburban: word('ΠΡΟΑΣΤΙΑΚ\\p{L}*'),
}

export function isRailAnnouncement(a: Announcement): boolean {
  const title = fold(a.title)
  const text = `${title} ${fold(a.summary)} ${fold(htmlText(a.html))}`
  return TRAM_IN_TITLE.test(title) || SERVICE.some((pattern) => pattern.test(text))
}

/**
 * The stations an announcement's title names, among the modes it mentions (the metro when it names
 * none). Titles decline and shorten names ("ΣΤ. ΜΕΤΡΟ ΔΟΥΚ. ΠΛΑΚΕΝΤΙΑΣ", "σταθμός Συντάγματος"), so
 * each word of a name matches a word with the same stem or an abbreviation of it, in order. A whole
 * name has to match: "Αγία Παρασκευή" mustn't match the weekday.
 */
export function stationsNamed(a: Announcement, network: MetroNetwork): number[] {
  const title = tokens(fold(a.title))
  const text = `${fold(a.title)} ${fold(a.summary)} ${fold(htmlText(a.html))}`
  const modes = (Object.keys(MODE_WORDS) as MetroMode[]).filter((m) => MODE_WORDS[m].test(text))
  const wanted: MetroMode[] = modes.length > 0 ? modes : ['metro']
  return network.stations
    .filter((s) => wanted.includes(s.mode) && containsName(title, tokens(fold(s.name)).map((t) => t.word)))
    .map((s) => s.index)
}

interface Token {
  word: string
  /** Followed by a full stop: maybe an abbreviation */
  abbreviated: boolean
}

function tokens(text: string): Token[] {
  return [...text.matchAll(/([\p{L}\p{N}]+)(\.)?/gu)].map((m) => ({ word: m[1], abbreviated: m[2] === '.' }))
}

function containsName(title: Token[], name: string[]): boolean {
  if (name.length === 0) {
    return false
  }
  for (let i = 0; i + name.length <= title.length; i++) {
    if (name.every((w, k) => sameWord(title[i + k], w))) {
      return true
    }
  }
  return false
}

/** "ΣΥΝΤΑΓΜΑΤΟΣ" is "ΣΥΝΤΑΓΜΑ"; "ΔΟΥΚ." is "ΔΟΥΚΙΣΣΗΣ" */
function sameWord(token: Token, word: string): boolean {
  const t = token.word
  if (token.abbreviated && t.length >= 3 && t.length < word.length && word.startsWith(t)) {
    return true
  }
  const stem = word.length >= 6 ? word.slice(0, -2) : word.length >= 4 ? word.slice(0, -1) : word
  return t.startsWith(stem) && t.length <= word.length + 3
}

/** The rail announcements among `announcements`, published since `since` (epoch ms), newest first */
export function railNews(announcements: Announcement[], network: MetroNetwork, since: number): RailNews[] {
  return announcements
    .filter((a) => a.publishedAt >= since && isRailAnnouncement(a))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map((announcement) => ({ announcement, stations: stationsNamed(announcement, network) }))
}

/** Text of an announcement's HTML, enough for matching words (tags become spaces) */
function htmlText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ')
}
