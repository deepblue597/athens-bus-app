// Cloudflare Worker entry. wrangler.jsonc serves the built app (dist/) as static assets and only
// runs this for /oasa/* (OASA's telematics API), /oasa-web/* (announcements from www.oasa.gr),
// /ose/* (OSE's live Proastiakos departure boards) and /api/feedback (problem reports → GitHub issues).
import { handleFeedback, type FeedbackEnv } from './feedback.ts'
import { proxyOasa } from './oasaProxy.ts'
import { proxyOasaWeb, type WaitUntil } from './oasaWebProxy.ts'
import { proxyOse } from './oseProxy.ts'

interface Env extends FeedbackEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  fetch(request: Request, env: Env, ctx: WaitUntil): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/oasa/')) {
      return proxyOasa(request)
    }
    if (pathname.startsWith('/oasa-web/')) {
      return proxyOasaWeb(request, ctx)
    }
    if (pathname.startsWith('/ose/')) {
      return proxyOse(request)
    }
    if (pathname === '/api/feedback') {
      return handleFeedback(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
