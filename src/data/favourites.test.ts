// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Stop } from '../domain/types'

const omonoia: Stop = {
  code: '60134',
  displayId: '060134',
  name: 'ΠΛ. ΟΜΟΝΟΙΑΣ',
  nameEn: 'PL. OMONOIAS',
  street: 'ΑΘΗΝΑΣ',
  lat: 37.983368,
  lng: 23.727903,
}

// Fresh module state per test (the store caches its snapshot)
async function load() {
  vi.resetModules()
  return import('./favourites')
}

describe('favourites', () => {
  beforeEach(() => localStorage.clear())

  it('adds and removes a stop', async () => {
    const { getFavourites, toggleFavourite } = await load()
    toggleFavourite(omonoia)
    expect(getFavourites().map((s) => s.code)).toEqual(['60134'])
    toggleFavourite(omonoia)
    expect(getFavourites()).toEqual([])
  })

  it('persists across reloads, without the street', async () => {
    ;(await load()).toggleFavourite(omonoia)
    const saved = (await load()).getFavourites()
    expect(saved).toEqual([{ code: '60134', displayId: '060134', name: 'ΠΛ. ΟΜΟΝΟΙΑΣ', nameEn: 'PL. OMONOIAS', lat: 37.983368, lng: 23.727903 }])
  })

  it('returns the same array until something changes', async () => {
    const { getFavourites, toggleFavourite } = await load()
    expect(getFavourites()).toBe(getFavourites())
    const before = getFavourites()
    toggleFavourite(omonoia)
    expect(getFavourites()).not.toBe(before)
  })

  it('notifies subscribers', async () => {
    const { subscribeFavourites, toggleFavourite } = await load()
    const onChange = vi.fn()
    const unsubscribe = subscribeFavourites(onChange)
    toggleFavourite(omonoia)
    unsubscribe()
    toggleFavourite(omonoia)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('ignores corrupt storage', async () => {
    localStorage.setItem('athens-bus:favourite-stops', '{not json')
    expect((await load()).getFavourites()).toEqual([])
  })

  it('skips entries without a stop code', async () => {
    localStorage.setItem('athens-bus:favourite-stops', JSON.stringify([null, { name: 'x' }, { ...omonoia, street: undefined }]))
    expect((await load()).getFavourites().map((s) => s.code)).toEqual(['60134'])
  })
})
