import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Network } from '@capacitor/network'

export function useNativeFeatures() {
  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function setup() {
      // Only run on native platforms
      const info = await App.getInfo().catch(() => null)
      if (!info) return

      // Set status bar to match theme
      try {
        await StatusBar.setStyle({ style: Style.Light })
        await StatusBar.setBackgroundColor({ color: '#155571' })
      } catch {
        // Not available on web
      }

      // Handle Android back button — navigate back instead of exiting
      const backListener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          void App.exitApp()
        }
      })

      cleanup = () => {
        void backListener.remove()
      }
    }

    void setup()

    return () => {
      if (cleanup) cleanup()
    }
  }, [])
}

export { Network }
