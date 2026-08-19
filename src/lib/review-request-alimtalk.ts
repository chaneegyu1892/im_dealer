import { enqueueAlimtalk } from "@/lib/alimtalk/enqueue";
import {
  buildReviewRequestButtons,
  buildReviewRequestMessage,
} from "@/lib/alimtalk/templates";
import { issueOrReuseReviewToken } from "@/lib/review-token-issue";

export type ReviewRequestQuote = {
  readonly id: string;
  readonly phone: string | null;
  readonly customerName: string | null;
  readonly userId: string | null;
};

export type ReviewRequestAlimtalkResult =
  | { readonly ok: true; readonly reused: boolean }
  | { readonly ok: false; readonly reason: "disabled"; readonly reused: boolean };

export class ReviewRequestEnqueueError extends Error {
  readonly name = "ReviewRequestEnqueueError";
  constructor(readonly reason: string) {
    super(`review request enqueue failed: ${reason}`);
  }
}

export async function requestReviewAlimtalkForQuote(params: {
  readonly quote: ReviewRequestQuote;
  readonly actorId: string;
}): Promise<ReviewRequestAlimtalkResult> {
  const { quote, actorId } = params;
  const issued = await issueOrReuseReviewToken({
    quoteId: quote.id,
    createdById: actorId,
  });

  const result = await enqueueAlimtalk({
    templateKey: "REVIEW_REQUEST",
    phone: quote.phone,
    message: buildReviewRequestMessage({
      고객명: quote.customerName ?? "고객",
      링크: issued.url,
    }),
    buttons: buildReviewRequestButtons(issued.url),
    userId: quote.userId ?? undefined,
    refType: "review",
    refId: quote.id,
  });

  if (result.ok) {
    return { ok: true, reused: issued.reused };
  }

  switch (result.reason) {
    case "disabled":
      return { ok: false, reason: "disabled", reused: issued.reused };
    case "no_template_code":
    case "invalid_phone":
      throw new ReviewRequestEnqueueError(result.reason);
    default: {
      const unreachable: never = result.reason;
      throw new ReviewRequestEnqueueError(String(unreachable));
    }
  }
}
