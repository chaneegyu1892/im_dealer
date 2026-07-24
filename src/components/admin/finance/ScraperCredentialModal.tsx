"use client";

import { useState } from "react";

interface Props {
  financeCompanyId: string;
  financeCompanyName: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 캐피탈사 스크래핑 자격증명 등록/수정 모달 (쓰기 전용 — 저장된 값은 표시하지 않음).
 * 저장 시 서버가 ID/PW 를 즉시 암호화한다. PUT 은 superadmin 권한이 필요.
 */
export default function ScraperCredentialModal({
  financeCompanyId,
  financeCompanyName,
  onClose,
  onSaved,
}: Props) {
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [requiresHuman, setRequiresHuman] = useState(false);
  const [configText, setConfigText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!loginUrl.trim() || !username.trim() || !password.trim()) {
      setError("로그인 URL · ID · 비밀번호를 모두 입력하세요.");
      return;
    }
    let config: unknown = undefined;
    if (configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch {
        setError("고급 설정(JSON) 형식이 올바르지 않습니다.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/scraper-credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financeCompanyId,
          loginUrl: loginUrl.trim(),
          username: username.trim(),
          password,
          requiresHuman,
          config: config ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다. (자격증명 등록은 최고 관리자 권한이 필요합니다)");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
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
        <h3 className="text-base font-bold text-[#1A1A2E]">{financeCompanyName} 로그인 정보</h3>
        <p className="mt-1 text-xs text-[#9BA4C0]">
          입력한 ID/PW 는 암호화되어 저장되며 화면에 다시 표시되지 않습니다.
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="url"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
            placeholder="로그인 페이지 URL (https://...)"
            className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-sm focus:border-[#6066EE] focus:outline-none"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="로그인 ID"
            autoComplete="off"
            className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-sm focus:border-[#6066EE] focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="new-password"
            className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-sm focus:border-[#6066EE] focus:outline-none"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-[#6B7399]">
            <input
              type="checkbox"
              checked={requiresHuman}
              onChange={(e) => setRequiresHuman(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#6066EE]"
            />
            휴대폰 인증·키보드보안 등 사람 개입 필요 (창을 띄워 직접 인증)
          </label>
          <details className="text-xs text-[#6B7399]">
            <summary className="cursor-pointer font-semibold">고급 설정 (JSON, 선택)</summary>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder={'{\n  "quoteUrlTemplate": "https://site/quote?trim={code}",\n  "trimMap": { "트림ID": "외부코드" }\n}'}
              rows={5}
              className="mt-2 w-full rounded-lg border border-[#E8EAF2] px-3 py-2 font-mono text-[11px] focus:border-[#6066EE] focus:outline-none"
            />
          </details>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-lg bg-[#000666] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E8EAF2] px-4 py-2 text-sm font-bold text-[#6B7399]"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
