// Cloudflare Worker entry. wrangler.jsonc serves the built app (dist/) as static assets and only
// runs this for /oasa/*, which goes to the OASA proxy.
import { proxyOasa } from './oasaProxy.ts'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    return pathname.startsWith('/oasa/') ? proxyOasa(request) : env.ASSETS.fetch(request)
  },
}
