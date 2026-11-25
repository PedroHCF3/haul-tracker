import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pedrohcf3.haultracker',
  appName: 'Haul Tracker',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    OtaKit: {
      appId: process.env.OTAKIT_APP_ID || 'YOUR_OTAKIT_APP_ID',
      channel: 'staging',
      runtimeVersion: '1.0.8',
    },
  },
};

export default config;
