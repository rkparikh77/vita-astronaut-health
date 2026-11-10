import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/appIcon";

// iOS home-screen icon. iOS applies its own rounded mask, so the art is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} />, size);
}
