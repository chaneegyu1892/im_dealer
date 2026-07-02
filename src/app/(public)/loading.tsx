export default function PublicLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-5">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-soft border-t-brand" />
        <p className="text-[13px] font-bold text-text-muted">불러오는 중...</p>
      </div>
    </div>
  );
}
