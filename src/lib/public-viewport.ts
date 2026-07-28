import type { Viewport } from "next";

export const PUBLIC_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F5F6FA",
};

export const ROOT_TOUCH_ACTION = "pan-x pan-y" as const;
