"use client";

import {
  useCallback,
  useEffect,
  useState,
  type RefObject,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type ScrollRequest = {
  readonly target: RefObject<HTMLElement | null>;
  readonly block: ScrollLogicalPosition;
};

type RequestRecommendScroll = (
  target: RefObject<HTMLElement | null>,
  block?: ScrollLogicalPosition
) => void;

export function getRecommendScrollBehavior(): ScrollBehavior {
  if (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(REDUCED_MOTION_QUERY).matches
  ) {
    return "auto";
  }

  return "smooth";
}

export function useRecommendAutoScroll(): RequestRecommendScroll {
  const [request, setRequest] = useState<ScrollRequest | null>(null);

  useEffect(() => {
    const element = request?.target.current;
    if (!element || typeof element.scrollIntoView !== "function") return;

    element.scrollIntoView({
      behavior: getRecommendScrollBehavior(),
      block: request.block,
      inline: "nearest",
    });
  }, [request]);

  return useCallback((target, block = "start") => {
    setRequest({ target, block });
  }, []);
}
