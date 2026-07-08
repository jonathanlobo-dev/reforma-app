import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reforma.ai",
  appName: "RenovAI",
  webDir: "dist",
  server: {
    // Permite http (backend local) durante desarrollo en el dispositivo.
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
