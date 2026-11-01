import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'moryonGoPh.app',
  appName: 'MoryonGoPh',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#155571',
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#155571',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#155571',
    },
  },
}

export default config
