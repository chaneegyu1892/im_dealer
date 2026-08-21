import { enqueueAlimtalk } from "@/lib/alimtalk/enqueue";
import {
  buildSignupCompletedButtons,
  buildSignupCompletedMessage,
} from "@/lib/alimtalk/templates";

export type SignupCompletedTarget = {
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly referralCode: string;
  readonly signedUpAt: Date;
};

export type SignupCompletedAlimtalkResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "disabled" | "no_template_code" };

export class SignupCompletedEnqueueError extends Error {
  readonly name = "SignupCompletedEnqueueError";
  constructor(readonly reason: string) {
    super(`signup completed enqueue failed: ${reason}`);
  }
}

export async function sendSignupCompletedAlimtalk(
  target: SignupCompletedTarget,
): Promise<SignupCompletedAlimtalkResult> {
  const result = await enqueueAlimtalk({
    templateKey: "SIGNUP_COMPLETED",
    phone: target.phone,
    message: buildSignupCompletedMessage({
      고객명: target.name,
      가입일: target.signedUpAt,
      추천코드: target.referralCode,
    }),
    buttons: buildSignupCompletedButtons(),
    userId: target.userId,
    refType: "signup",
    refId: target.userId,
  });

  if (result.ok) {
    return { ok: true };
  }

  switch (result.reason) {
    case "disabled":
    // 템플릿 검수 승인 전(ALIMTALK_ENABLED=true + 코드 미설정)은 예정된 상태다.
    // 던지면 가입마다 에러 로그가 쌓이므로 disabled 와 같이 조용히 건너뛴다.
    case "no_template_code":
      return { ok: false, reason: result.reason };
    case "invalid_phone":
      throw new SignupCompletedEnqueueError(result.reason);
    default: {
      const unreachable: never = result.reason;
      throw new SignupCompletedEnqueueError(String(unreachable));
    }
  }
}
