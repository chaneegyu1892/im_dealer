export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-[#E8EAF0] border-t-[#000666] rounded-full animate-spin" />
        <p className="text-[12px] text-[#9BA4C0]">불러오는 중...</p>
      </div>
    </div>
  );
}
