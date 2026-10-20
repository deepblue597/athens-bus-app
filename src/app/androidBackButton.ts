import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android's back gesture/button in the native app. Without a listener Android closes the app;
 * this makes back close an open sheet first, then go to the previous page like the browser's back
 * button, and on the first screen send the app to the background (Android's usual behaviour,
 * keeping its state) instead of closing it.
 */
export function handleAndroidBackButton() {
  if (Capacitor.getPlatform() !== 'android') {
    return
  }
  void App.addListener('backButton', ({ canGoBack }) => {
    const openDialog = document.querySelector<HTMLDialogElement>('dialog[open]')
    if (openDialog) {
      openDialog.close()
    } else if (canGoBack) {
      window.history.back()
    } else {
      void App.minimizeApp()
    }
  })
}
