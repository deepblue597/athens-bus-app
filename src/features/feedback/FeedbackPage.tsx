import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useOnline } from '../../app/useOnline'
import { describeApp, deviceDescription, sendFeedback } from '../../data/feedback'
import { cleanPage, FEEDBACK_KINDS, MESSAGE_MAX, MESSAGE_MIN, type FeedbackKind } from '../../domain/feedback'
import { SOURCE_URL } from '../download/release'
import './Feedback.css'

type Status = { state: 'editing' } | { state: 'sending' } | { state: 'sent'; url: string | null } | { state: 'failed'; message: string }

/**
 * "Report a problem": the report becomes a public GitHub issue (worker/feedback.ts). What is sent
 * with it is listed on the page, so nothing goes that people can't see.
 */
export function FeedbackPage() {
  const [params] = useSearchParams()
  const page = cleanPage(params.get('from'))
  const online = useOnline()
  const [kind, setKind] = useState<FeedbackKind>('problem')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [app, setApp] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'editing' })
  const device = deviceDescription()

  useEffect(() => {
    void describeApp().then(setApp)
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus({ state: 'sending' })
    try {
      const { url } = await sendFeedback({ kind, message, page, app, device, website })
      setStatus({ state: 'sent', url })
    } catch (err) {
      setStatus({ state: 'failed', message: (err as Error).message })
    }
  }

  if (status.state === 'sent') {
    return (
      <article className="feedback-page">
        <title>Report sent · Athens Bus</title>
        <h1>Thank you</h1>
        <p role="status">
          Your report was sent.
          {status.url && (
            <>
              {' '}
              You can follow it <a href={status.url}>on GitHub</a>.
            </>
          )}
        </p>
        <p>
          <Link to={page ?? '/'}>{page ? 'Back to where you were' : 'Back to the app'}</Link>
        </p>
      </article>
    )
  }

  const tooShort = message.trim().length < MESSAGE_MIN
  const sending = status.state === 'sending'

  return (
    <article className="feedback-page">
      <title>Report a problem · Athens Bus</title>
      <h1>Report a problem</h1>
      <p className="feedback-intro">
        Tell us what went wrong, what’s missing or what you’d like. Reports are published on GitHub for anyone to read,
        so please don’t include your name, phone number or other personal details.
      </p>

      <form onSubmit={submit} noValidate>
        <fieldset className="feedback-kinds">
          <legend>What is it about?</legend>
          {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
            <label key={k}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              {FEEDBACK_KINDS[k].label}
            </label>
          ))}
        </fieldset>

        <label htmlFor="feedback-message" className="feedback-label">
          What happened?
        </label>
        <p id="feedback-hint" className="feedback-hint">
          For a wrong arrival or timetable, say which line, which stop and when.
        </p>
        <textarea
          id="feedback-message"
          aria-describedby="feedback-hint feedback-count"
          rows={6}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p id="feedback-count" className="feedback-hint feedback-count">
          {message.length} / {MESSAGE_MAX}
        </p>

        {/* Hidden from people; bots that fill in every field fill this in and are ignored */}
        <div className="visually-hidden" aria-hidden="true">
          <label>
            Leave this empty
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <h2 className="feedback-label">Sent with your report</h2>
        <dl className="feedback-details">
          {page && (
            <>
              <dt>Page</dt>
              <dd>{page}</dd>
            </>
          )}
          <dt>App</dt>
          <dd>{app || '…'}</dd>
          <dt>Device</dt>
          <dd>{device}</dd>
        </dl>

        <div aria-live="polite">
          {!online && <p className="feedback-error">You’re offline. You can send the report once you’re back online.</p>}
          {status.state === 'failed' && <p className="feedback-error">{status.message}</p>}
        </div>

        <button type="submit" className="feedback-submit" disabled={tooShort || sending || !online || !app}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
        {tooShort && message.length > 0 && (
          <p className="feedback-hint">Please write at least {MESSAGE_MIN} characters.</p>
        )}
      </form>

      <p className="feedback-hint feedback-github">
        Have a GitHub account? You can also <a href={`${SOURCE_URL}/issues/new`}>open an issue there</a> and get replies.
      </p>
    </article>
  )
}
