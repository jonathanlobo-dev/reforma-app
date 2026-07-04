import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reforma.ai",
  appName: "Reforma AI",
  webDir: "dist",
  server: {
    // Permite http (backend local) durante desarrollo en el dispositivo.
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
