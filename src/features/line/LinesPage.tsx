import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { searchLines } from '../../domain/search'
import type { LinePageState } from './LinePage'
import { useLines } from './useLineData'
import './LinesPage.css'

export function LinesPage() {
  // The query lives in the URL (?q=040), so a search can be shared and survives going back
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const { data: lines, isPending, isPaused, isError, refetch } = useLines()
  const results = useMemo(() => (lines ? searchLines(lines, query) : []), [lines, query])

  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true })
  const count = results.length === 1 ? '1 line' : `${results.length} lines`
  // Announce the result count once typing pauses, not after every key
  const announcement = useDebounced(!lines || !query ? '' : results.length === 0 ? `No lines match “${query}”.` : count, 700)

  return (
    <section className="lines-page">
      <title>Lines · Athens Bus</title>
      <h1 className="visually-hidden">Lines</h1>

      <form
        role="search"
        className="lines-search"
        // Results update as you type, so Enter jumps to the first one (and closes a phone keyboard)
        onSubmit={(e) => {
          e.preventDefault()
          listRef.current?.querySelector('a')?.focus()
        }}
      >
        <label htmlFor="line-search" className="visually-hidden">
          Search lines by number or name
        </label>
        <input
          ref={inputRef}
          id="line-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Line number or name, e.g. 040 or Κηφισιά"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div aria-live="polite" className="lines-status">
        {isPending && (
          <p>{isPaused ? 'The line list isn’t saved on this device yet. It will load when you’re back online.' : 'Loading lines…'}</p>
        )}
        {isError && (
          <p>
            Couldn’t load the lines.{' '}
            <button type="button" className="link-button" onClick={() => refetch()}>
              Try again
            </button>
          </p>
        )}
        {lines && query && results.length > 0 && <p aria-hidden="true">{count}</p>}
        <span className="visually-hidden">{announcement}</span>
      </div>

      {lines && query && results.length === 0 && (
        <div className="lines-empty">
          <p className="lines-empty-title">No lines match “{query}”.</p>
          <p>Try a line number such as 040 or Β1, or a place on the route such as Κηφισιά or Glyfada.</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            Clear search
          </button>
        </div>
      )}

      <ul className="line-list" ref={listRef}>
        {results.map((line) => (
          <li key={line.code}>
            <Link
              to={`/line/${line.code}`}
              state={{ line, linesQuery: query || undefined } satisfies LinePageState}
              className="line-list-item"
            >
              <span className="line-badge">{line.id}</span>
              <span className="line-list-name">
                {line.name}
                {line.nameEn && <span className="line-list-name-en">{line.nameEn}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
