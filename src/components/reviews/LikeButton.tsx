"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrCreateAnonId } from "@/lib/anon-id";

interface LikeButtonProps {
  reviewId: string;
  initialLikeCount: number;
  initialLiked?: boolean;
  size?: "sm" | "md";
  variant?: "ghost" | "filled";
  className?: string;
  onChange?: (liked: boolean, likeCount: number) => void;
  stopPropagation?: boolean;
}

export function LikeButton({
  reviewId,
  initialLikeCount,
  initialLiked = false,
  size = "md",
  variant = "ghost",
  className,
  onChange,
  stopPropagation = false,
}: LikeButtonProps) {
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [count, setCount] = useState<number>(initialLikeCount);
  const [pending, setPending] = useState(false);
  const [anonId, setAnonId] = useState<string>("");

  useEffect(() => {
    setAnonId(getOrCreateAnonId());
  }, []);

  useEffect(() => {
    setCount(initialLikeCount);
  }, [initialLikeCount]);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (pending || !anonId) return;

    const prevLiked = liked;
    const prevCount = count;
    const optimisticLiked = !prevLiked;
    const optimisticCount = optimisticLiked
      ? prevCount + 1
      : Math.max(0, prevCount - 1);

    setLiked(optimisticLiked);
    setCount(optimisticCount);
    setPending(true);

    try {
      const res = await fetch(`/api/public/reviews/${reviewId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        success: boolean;
        data: { liked: boolean; likeCount: number };
      };
      if (json.success && json.data) {
        setLiked(json.data.liked);
        setCount(json.data.likeCount);
        onChange?.(json.data.liked, json.data.likeCount);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  const sizeClasses =
    size === "sm"
      ? "h-8 px-2.5 text-[12px] gap-1"
      : "h-9 px-3 text-[13px] gap-1.5";
  const iconSize = size === "sm" ? 14 : 16;

  const variantClasses =
    variant === "filled"
      ? liked
        ? "bg-primary text-white border border-primary"
        : "bg-white text-ink border border-[#E5E7F0] hover:border-primary/40"
      : liked
        ? "text-primary border border-primary/30 bg-primary/5"
        : "text-ink-caption border border-[#E5E7F0] bg-white hover:text-ink hover:border-[#CDD2E4]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || !anonId}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors disabled:opacity-60",
        sizeClasses,
        variantClasses,
        className
      )}
    >
      <Heart
        size={iconSize}
        className={cn(
          "transition-transform",
          liked ? "fill-current scale-110" : "fill-none"
        )}
      />
      <span>{count}</span>
    </button>
  );
}
