"use client";

import { useState } from "react";

interface Props {
  financeCompanyName: string;
  /**
   * 키패드·SMS 등으로 사람이 직접 로그인해야 하는 캐피탈사.
   * 이 경우 워커 어댑터가 ID/PW 를 쓰지 않으므로 입력을 받지 않는다.
   */
  requiresHuman?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => void;
}

/**
 * 캐피탈사 로그인 모달.
 *
 * ORIX 처럼 어댑터가 자동 로그인하는 곳은 ID/PW 를 입력받는다(가져오기마다 직접 입력, 저장 안 함).
 * 신한·우리금융·JB 처럼 키패드가 걸린 곳은 자동 타이핑이 불가해 워커가 브라우저를 띄우고
 * 사람에게 로그인을 넘기므로, 여기서 받아봐야 쓰이지 않는다 → 안내만 하고 바로 시작한다.
 */
export default function ScraperLoginModal({
  financeCompanyName,
  requiresHuman = false,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (requiresHuman) {
      onSubmit("", "");
      return;
    }
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
        <h3 className="text-base font-bold text-[#1A1A2E]">
          {financeCompanyName} {requiresHuman ? "수집 시작" : "로그인"}
        </h3>

        {requiresHuman ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-[#9BA4C0]">
              이 캐피탈사는 키보드보안·추가인증 때문에 자동 로그인이 되지 않습니다.
              아이디·비밀번호를 여기에 입력하지 않습니다.
            </p>
            <ol className="mt-4 space-y-2 rounded-xl bg-[#F8F9FC] p-4 text-[13px] leading-relaxed text-[#4A5070]">
              <li>
                <span className="font-bold text-[#000666]">1.</span> 수집 PC 에서 브라우저 창이 자동으로 열립니다.
              </li>
              <li>
                <span className="font-bold text-[#000666]">2.</span> 그 창에서 직접 로그인하세요.
              </li>
              <li>
                <span className="font-bold text-[#000666]">3.</span> 로그인이 끝나면 이 화면에서{" "}
                <span className="font-bold">[재개]</span> 를 누르세요.
              </li>
            </ol>
            <p className="mt-3 text-[11px] text-[#B0B8D0]">
              수집 PC 에서 &lsquo;수집 시작&rsquo; 프로그램이 실행 중이어야 창이 열립니다.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-[#000666] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "시작 중..." : requiresHuman ? "수집 시작" : "로그인 후 가져오기"}
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
