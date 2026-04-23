export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-primary-100 border-t-primary rounded-full animate-spin" />
        <p className="text-[13px] text-secondary">불러오는 중...</p>
      </div>
    </div>
  );
}
