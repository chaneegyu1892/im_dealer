"use client";

import { useState } from "react";

interface Props {
  financeCompanyName: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
}

/**
 * 캐피탈사 로그인 입력 모달 (가져오기마다 개인 계정 직접 입력).
 * 입력값은 저장하지 않으며, 수집 작업이 진행되는 동안에만 암호화되어 임시 사용된다.
 */
export default function ScraperLoginModal({
  financeCompanyName,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("로그인 ID · 비밀번호를 입력하세요.");
      return;
    }
    onSubmit(username.trim(), password);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[#1A1A2E]">{financeCompanyName} 로그인</h3>
        <p className="mt-1 text-xs text-[#9BA4C0]">
          본인 캐피탈 계정으로 로그인합니다. 입력한 정보는 저장되지 않으며 수집이 끝나면 폐기됩니다.
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="로그인 ID"
            autoComplete="off"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-sm focus:border-[#6066EE] focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="new-password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-sm focus:border-[#6066EE] focus:outline-none"
          />
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-[#000666] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "시작 중..." : "로그인 후 가져오기"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[#E8EAF2] px-4 py-2 text-sm font-bold text-[#6B7399] disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
