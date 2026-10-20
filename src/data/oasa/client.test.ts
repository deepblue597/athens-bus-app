import { describe, expect, it } from 'vitest'
import { isOasaCode } from './client'

describe('isOasaCode', () => {
  it.each(['400075', '60134', '-2'])('accepts %s', (code) => {
    expect(isOasaCode(code)).toBe(true)
  })

  it.each(['', 'abc', '1&p1=2', '10272 ', '1.5', '--2'])('rejects %j', (code) => {
    expect(isOasaCode(code)).toBe(false)
  })
})
