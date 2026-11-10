import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Let phones on the same Wi-Fi load the dev server (`npm run dev:phone`).
const lanHosts = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  // Keep the dev overlay badge off so phone demos look like the real app.
  devIndicators: false,
};

export default nextConfig;
