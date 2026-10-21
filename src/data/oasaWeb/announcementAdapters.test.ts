import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/posts-announcements.json'
import { decodeEntities, htmlToText, OasaWebError, summarise, toAnnouncement, toAnnouncementsPage } from './announcementAdapters'

describe('toAnnouncementsPage', () => {
  it('reads a real page of announcements (oasa.gr, 21 Oct 2026)', () => {
    const page = toAnnouncementsPage(fixture)
    expect(page.items).toHaveLength(20)
    const [first] = page.items
    expect(first.id).toBe(14884)
    expect(first.title).toBe('Νεότερη ενημέρωση- Άνοιξε ο σταθμός “Πανεπιστήμιο” , Τετάρτη 21/10/2026')
    // date_gmt 2026-10-21T12:06:30 is UTC: 15:06 in Athens
    expect(first.publishedAt).toBe(Date.UTC(2026, 9, 21, 12, 6, 30))
    expect(first.url).toMatch(/^https:\/\/www\.oasa\.gr\//)
    expect(first.html).toContain('<p>')
    for (const a of page.items) {
      expect(a.updatedAt).toBeGreaterThanOrEqual(a.publishedAt)
      expect(a.summary.length).toBeGreaterThan(0)
      expect(a.summary).not.toMatch(/^Με στόχο/)
    }
  })

  it('gives the last post’s UTC time as the cursor for older posts when the page is full', () => {
    expect(toAnnouncementsPage(fixture).nextBefore).toBe('2026-10-14T04:00:01Z')
    expect(toAnnouncementsPage(fixture.slice(0, 5)).nextBefore).toBeNull()
  })

  it('is empty, without a cursor, when there are no posts', () => {
    expect(toAnnouncementsPage([])).toEqual({ items: [], nextBefore: null })
  })

  it('leaves out posts it can’t read but keeps the rest', () => {
    const page = toAnnouncementsPage([{ id: 'x' }, null, fixture[1]])
    expect(page.items.map((a) => a.id)).toEqual([fixture[1].id])
  })

  it('fails when nothing on a non-empty page can be read, since the format must have changed', () => {
    expect(() => toAnnouncementsPage([{ ID: 1 }, { ID: 2 }])).toThrow(OasaWebError)
  })

  it('fails on answers that are not a list', () => {
    expect(() => toAnnouncementsPage({ code: 'rest_no_route' })).toThrow(OasaWebError)
    expect(() => toAnnouncementsPage('<html>')).toThrow(OasaWebError)
  })
})

describe('toAnnouncement', () => {
  const post = {
    id: 7,
    date_gmt: '2026-03-01T22:30:00',
    modified_gmt: '2026-03-02T08:00:00',
    link: 'https://www.oasa.gr/blog/2026/03/02/x/',
    title: { rendered: 'Στάση εργασίας &#8211; &#8220;Μετρό&#8221; &amp; ΗΣΑΠ' },
    content: { rendered: '<p>Κείμενο</p>' },
  }

  it('decodes the title and reads UTC times', () => {
    const a = toAnnouncement(post)
    expect(a.title).toBe('Στάση εργασίας – “Μετρό” & ΗΣΑΠ')
    expect(a.publishedAt).toBe(Date.UTC(2026, 2, 1, 22, 30))
    expect(a.updatedAt).toBe(Date.UTC(2026, 2, 2, 8))
  })

  it('only keeps links to oasa.gr', () => {
    expect(toAnnouncement({ ...post, link: 'javascript:alert(1)' }).url).toBe('https://www.oasa.gr/?p=7')
    expect(toAnnouncement({ ...post, link: 'https://www.oasa.gr.evil.example/' }).url).toBe('https://www.oasa.gr/?p=7')
  })

  it('fails on a post without a date or title', () => {
    expect(() => toAnnouncement({ ...post, date_gmt: undefined })).toThrow(OasaWebError)
    expect(() => toAnnouncement({ ...post, title: { rendered: ' ' } })).toThrow(OasaWebError)
  })
})

describe('summarise', () => {
  it('drops OASA’s standard opening and capitalises what follows', () => {
    expect(
      summarise(
        'Με στόχο την ενημέρωση και την καλύτερη εξυπηρέτηση του επιβατικού κοινού, ο ΟΑΣΑ ανακοινώνει ότι, με εντολή της ΕΛ.ΑΣ., είναι κλειστός ο σταθμός.',
      ),
    ).toBe('Με εντολή της ΕΛ.ΑΣ., είναι κλειστός ο σταθμός.')
    expect(
      summarise(
        'Με στόχο την έγκυρη ενημέρωση και την καλύτερη εξυπηρέτηση του επιβατικού κοινού, ο ΟΑΣΑ ανακοινώνει την παράταση.',
      ),
    ).toBe('Την παράταση.')
  })

  it('leaves other openings alone', () => {
    expect(summarise('Σας ενημερώνουμε ότι ο σταθμός άνοιξε.')).toBe('Σας ενημερώνουμε ότι ο σταθμός άνοιξε.')
  })

  it('cuts long text at a word', () => {
    const summary = summarise('λέξη '.repeat(100))
    expect(summary.length).toBeLessThanOrEqual(201)
    expect(summary).toMatch(/λέξη…$/)
  })
})

describe('htmlToText', () => {
  it('keeps words apart across line breaks and paragraphs', () => {
    expect(htmlToText('<p>Α<br />Β</p><p>Γ&nbsp;<strong>060</strong></p><ul><li>Δ</li><li>Ε</li></ul>')).toBe('Α Β Γ 060 Δ Ε')
  })
})

describe('decodeEntities', () => {
  it('decodes numeric and common named entities and leaves unknown ones', () => {
    expect(decodeEntities('&#8220;x&#8221; &#x3a9; &laquo;y&raquo; &bogus; &#0;')).toBe('“x” Ω «y» &bogus; &#0;')
  })
})
