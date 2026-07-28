import type { Metadata } from "next";
import { Suspense } from "react";
import LoginContent from "./LoginContent";

export const metadata: Metadata = {
  title: "로그인",
  description: "아임딜러 로그인",
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
