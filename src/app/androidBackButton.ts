import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { activeSection, isTabPage, sectionPath } from './nav'

interface Navigator {
  navigate: (to: string) => unknown
  state: { location: { pathname: string; state: unknown } }
}

/**
 * Android's back gesture/button in the native app. Without a listener Android closes the app.
 * Android's rule for apps with a bottom bar: back closes an open sheet first; inside a tab it goes
 * to the previous page; from any other tab it goes to the first tab (Nearby); and from Nearby it sends
 * the app to the background (keeping its state) instead of closing it.
 */
export function handleAndroidBackButton(router: Navigator) {
  if (Capacitor.getPlatform() !== 'android') {
    return
  }
  void App.addListener('backButton', ({ canGoBack }) => {
    const openDialog = document.querySelector<HTMLDialogElement>('dialog[open]')
    const { pathname, state } = router.state.location
    if (openDialog) {
      openDialog.close()
    } else if (pathname === '/') {
      void App.minimizeApp()
    } else if (isTabPage(pathname)) {
      void router.navigate('/')
    } else if (canGoBack) {
      window.history.back()
    } else {
      // Opened straight on a page (a shared link): go up to its tab
      const section = activeSection(pathname, state)
      void router.navigate(section ? sectionPath(section) : '/')
    }
  })
}
