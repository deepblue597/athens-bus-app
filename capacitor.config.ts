import type { CapacitorConfig } from '@capacitor/cli'

// Android app: the same web app in a native shell (npm run build:android, then open android/ in Android Studio)
const config: CapacitorConfig = {
  appId: 'org.deepblue597.athensbus',
  appName: 'Athens Bus',
  webDir: 'dist',
  plugins: {
    // The app draws under the system bars (viewport-fit=cover in index.html); saying so up front
    // avoids a layout jump while the page loads
    SystemBars: { initialViewportFitValueHint: 'cover' },
  },
}

export default config
