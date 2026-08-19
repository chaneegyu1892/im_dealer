// (member)/mypage 세그먼트 로딩 상태.
// Suspense fallback 은 mypage/layout.tsx (MyPageTabs) 하위 콘텐츠 영역에 렌더되므로
// 탭은 유지된 채 본문만 스피너로 대체한다.
// 스피너 톤은 기존 (public)/loading.tsx (border-brand-soft / border-t-brand) 를 따른다.
export default function MyPageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-soft border-t-brand" />
        <p className="text-[13px] font-bold text-text-muted">불러오는 중...</p>
      </div>
    </div>
  );
}
