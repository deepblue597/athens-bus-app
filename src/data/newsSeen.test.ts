// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fresh module state per test (the store caches its snapshot)
async function load() {
  vi.resetModules()
  return import('./newsSeen')
}

describe('newsSeen', () => {
  beforeEach(() => localStorage.clear())

  it('is null until News has been read', async () => {
    expect((await load()).getNewsSeenUntil()).toBeNull()
  })

  it('remembers the newest time seen, across reloads', async () => {
    ;(await load()).markNewsSeen(2000)
    expect((await load()).getNewsSeenUntil()).toBe(2000)
  })

  it('never goes back to an older time', async () => {
    const { getNewsSeenUntil, markNewsSeen } = await load()
    markNewsSeen(2000)
    markNewsSeen(1000)
    expect(getNewsSeenUntil()).toBe(2000)
  })

  it('tells subscribers when it changes', async () => {
    const { markNewsSeen, subscribeNewsSeen } = await load()
    const onChange = vi.fn()
    const unsubscribe = subscribeNewsSeen(onChange)
    markNewsSeen(1000)
    markNewsSeen(1000)
    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores a corrupted value', async () => {
    localStorage.setItem('athens-bus:news-seen-until', 'abc')
    expect((await load()).getNewsSeenUntil()).toBeNull()
  })
})
