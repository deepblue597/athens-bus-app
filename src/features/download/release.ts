import { useQuery } from '@tanstack/react-query'

const REPO = 'deepblue597/athens-bus-app'
/** Each GitHub release attaches the APK under this fixed name, so the "latest" link below always works */
const APK_ASSET = 'athens-bus.apk'

export const LATEST_APK_URL = `https://github.com/${REPO}/releases/latest/download/${APK_ASSET}`
export const SOURCE_URL = `https://github.com/${REPO}`
/** SHA-256 of the release signing certificate (CN=deepblue597), for people who want to verify the APK */
export const CERT_SHA256 = 'E6:BA:CC:AA:18:6B:52:C9:F5:82:FA:35:6A:5B:74:A1:7A:95:5A:7C:02:06:0F:23:53:18:35:93:58:87:C8:82'

export interface Release {
  version: string
  sizeMb: number | null
  publishedAt: string
}

/** The newest release on GitHub, to show its version and size next to the download button */
export function useLatestRelease() {
  return useQuery({
    queryKey: ['latestRelease'],
    queryFn: async (): Promise<Release> => {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) {
        throw new Error(`GitHub answered ${res.status}`)
      }
      const release = (await res.json()) as { tag_name: string; published_at: string; assets: { name: string; size: number }[] }
      const apk = release.assets.find((a) => a.name === APK_ASSET)
      return {
        version: release.tag_name.replace(/^v/, ''),
        sizeMb: apk ? apk.size / (1024 * 1024) : null,
        publishedAt: release.published_at,
      }
    },
    staleTime: 60 * 60_000,
  })
}
