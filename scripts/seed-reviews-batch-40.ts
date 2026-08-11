/**
 * 공개 후기 샘플 40건 추가 (기존 10건 + 40건 ≈ 50건 목표).
 *
 * 별점 분포: 3점 2 / 4점 15 / 5점 23
 * 3점 후기는 서비스 초기 불안 정도만 언급 — 과도한 비난 없음.
 *
 * 실행: pnpm exec tsx scripts/seed-reviews-batch-40.ts
 * 멱등: authorRealName 이 이미 있으면 스킵.
 */
import { prisma } from "../src/lib/prisma";

type SeedReview = {
  authorRealName: string;
  rating: number;
  content: string;
  vehicleHint: string; // 차량명 부분 매칭
  daysAgo: number;
  likeCount: number;
  isBest?: boolean;
};

const seeds: SeedReview[] = [
  // ── 별 3 (2) — 담백한 아쉬움 ─────────────────────────────
  {
    authorRealName: "서준호",
    rating: 3,
    content:
      "견적 자체는 보기 편했어요. 다만 아직 막 오픈한 느낌이라 가끔 로딩이 걸리거나 조건 바꾸면 숫자가 잠깐 비는 경우가 있더라구요. 큰 불만은 아니고 서비스가 안정되면 더 좋을 것 같아요. 상담 연결은 무난했습니다.",
    vehicleHint: "그랜저",
    daysAgo: 12,
    likeCount: 6,
  },
  {
    authorRealName: "문지아",
    rating: 3,
    content:
      "차종 비교 흐름은 괜찮은데, 초기 서비스라 그런지 옵션 설명이 조금 부족한 부분이 있었어요. 그래도 월 납입금 기준을 먼저 잡을 수 있어서 도움은 됐습니다. 업데이트 자주 되면 별점 올릴 의향이에요.",
    vehicleHint: "스포티지",
    daysAgo: 18,
    likeCount: 4,
  },

  // ── 별 4 (15) ──────────────────────────────────────────
  {
    authorRealName: "배현우",
    rating: 4,
    content:
      "쏘렌토 하이브리드 견적 여러 조건으로 돌려봤어요. 보증금 비율 바꿀 때마다 월납이 바로 나와서 가족끼리 상의하기 좋았습니다. 출고 일정 안내는 상담에서 따로 받았어요.",
    vehicleHint: "쏘렌토 HEV",
    daysAgo: 5,
    likeCount: 18,
  },
  {
    authorRealName: "노은서",
    rating: 4,
    content:
      "아반떼로 첫 장기렌트 알아봤는데, 이름·전화 안 넣고도 대략 월납 감이 잡혀서 편했어요. 세부 옵션 가격은 상담 때 한 번 더 확인하는 게 좋을 듯합니다.",
    vehicleHint: "아반떼",
    daysAgo: 8,
    likeCount: 15,
  },
  {
    authorRealName: "하민재",
    rating: 4,
    content:
      "카니발 법인 견적 비교용으로 썼습니다. 조건 표가 깔끔해서 내부 보고 자료로 쓰기 좋았어요. 트림이 많아서 처음엔 헷갈렸는데 기본값 추천이 도움됐습니다.",
    vehicleHint: "카니발",
    daysAgo: 11,
    likeCount: 21,
  },
  {
    authorRealName: "송예린",
    rating: 4,
    content:
      "아이오닉 계열 전기차 보조금 안내랑 월납을 같이 볼 수 있어서 좋았어요. 충전 환경은 제가 따로 알아봐야 했고, 견적 쪽은 만족합니다.",
    vehicleHint: "아이오닉",
    daysAgo: 14,
    likeCount: 17,
  },
  {
    authorRealName: "권태영",
    rating: 4,
    content:
      "GV80 리스 조건 볼 때 금융사별 차이가 보여서 참고가 많이 됐어요. UI가 모바일에서도 괜찮고, 상담 압박이 없어서 천천히 고를 수 있었습니다.",
    vehicleHint: "GV80",
    daysAgo: 16,
    likeCount: 19,
  },
  {
    authorRealName: "유시온",
    rating: 4,
    content:
      "싼타페 하이브리드 36/48개월 비교했어요. 연 주행거리 바꾸면 월납 차이가 확실히 보이더라구요. 재고·인도일은 별도 문의가 필요했습니다.",
    vehicleHint: "싼타페",
    daysAgo: 20,
    likeCount: 14,
  },
  {
    authorRealName: "장도윤",
    rating: 4,
    content:
      "K5 조건 맞출 때 보증금 없이 가는 시나리오가 있어서 초기 부담이 적었어요. 설명 문구가 조금 전문 용어인데 한두 번 보면 익숙해집니다.",
    vehicleHint: "K5",
    daysAgo: 23,
    likeCount: 12,
  },
  {
    authorRealName: "홍예준",
    rating: 4,
    content:
      "Model Y 견적 감 잡으려고 들렀어요. 테슬라 쪽 조건이 다른 국산차랑 비교하기 쉽게 정리돼 있어서 생각보다 판단이 빨랐습니다.",
    vehicleHint: "Model Y",
    daysAgo: 26,
    likeCount: 16,
  },
  {
    authorRealName: "오세린",
    rating: 4,
    content:
      "G80 만기 반납형이랑 인수형 차이를 먼저 보고 상담 갔어요. 숫자만 던져주는 게 아니라 시나리오가 나뉘어 있어서 이해하기 쉬웠어요.",
    vehicleHint: "G80",
    daysAgo: 29,
    likeCount: 20,
  },
  {
    authorRealName: "신우진",
    rating: 4,
    content:
      "X5 쪽 외제차도 볼 수 있어서 놀랐어요. 월납 범위가 넓어서 예산 필터를 먼저 쓰는 걸 추천합니다. 전반적으로 깔끔한 비교 도구 느낌.",
    vehicleHint: "X5",
    daysAgo: 32,
    likeCount: 11,
  },
  {
    authorRealName: "배수아",
    rating: 4,
    content:
      "스포티지 하이브리드 출퇴근용으로 봤어요. 조건 저장 후 다시 들어오면 이어서 볼 수 있어서 좋았고, 상담은 필요할 때만 하면 됩니다.",
    vehicleHint: "스포티지 HEV",
    daysAgo: 35,
    likeCount: 13,
  },
  {
    authorRealName: "김태호",
    rating: 4,
    content:
      "그랜저 하이브리드 선납/보증 비교가 핵심이었어요. 표 형태가 보기 좋고, 실제 계약 전 최종 확인은 상담사와 한 번 더 하는 게 맞다고 안내받아서 신뢰가 갔습니다.",
    vehicleHint: "그랜저 HEV",
    daysAgo: 38,
    likeCount: 22,
  },
  {
    authorRealName: "안소희",
    rating: 4,
    content:
      "E-Class 견적 감만 보려고 썼는데 생각보다 정보가 많았어요. 국산 대비 초기비용 차이를 한눈에 볼 수 있어서 현실 체크에 도움됐습니다.",
    vehicleHint: "E-Class",
    daysAgo: 42,
    likeCount: 10,
  },
  {
    authorRealName: "표재민",
    rating: 4,
    content:
      "카니발 하이브리드 7인승 위주로 필터링했어요. 가족 좌석 배치까지는 상세페이지에서 따로 봤고, 월납 비교 자체는 만족합니다.",
    vehicleHint: "카니발 HEV",
    daysAgo: 45,
    likeCount: 15,
  },
  {
    authorRealName: "문채원",
    rating: 4,
    content:
      "AI 추천으로 후보 세 대 뽑고 견적 화면에서 다시 좁혔어요. 추천 이유도 납득됐고, 최종은 제 예산에 맞춰 바꿨습니다. 흐름이 자연스러워요.",
    vehicleHint: "쏘렌토",
    daysAgo: 48,
    likeCount: 18,
  },

  // ── 별 5 (23) ──────────────────────────────────────────
  {
    authorRealName: "이도현",
    rating: 5,
    content:
      "장기렌트 처음인데 월 납입금이 먼저 보이니까 선택이 빨랐어요. 쏘렌토 조건 확정하고 상담도 짧게 끝났습니다. 주변에 추천했어요.",
    vehicleHint: "쏘렌토",
    daysAgo: 3,
    likeCount: 31,
    isBest: true,
  },
  {
    authorRealName: "박서연",
    rating: 5,
    content:
      "그랜저 하이브리드로 출퇴근 바꾸고 싶어서 여러 달 조건 돌려봤어요. 보증금 조금 올리니까 월납이 확 내려가서 바로 결정했습니다.",
    vehicleHint: "그랜저 HEV",
    daysAgo: 6,
    likeCount: 27,
  },
  {
    authorRealName: "최민석",
    rating: 5,
    content:
      "법인 카니발 견적 세 군데 비교했는데 여기가 조건 정리가 제일 보기 편했어요. 담당 상담도 숫자 기준으로 이야기해서 좋았습니다.",
    vehicleHint: "카니발",
    daysAgo: 7,
    likeCount: 29,
  },
  {
    authorRealName: "정하윤",
    rating: 5,
    content:
      "전기차 처음이라 보조금이랑 월납을 같이 보고 싶었어요. 아이오닉 쪽 조건을 비교하면서 현실적인 예산이 잡혔습니다.",
    vehicleHint: "아이오닉",
    daysAgo: 9,
    likeCount: 25,
  },
  {
    authorRealName: "강지우",
    rating: 5,
    content:
      "아반떼로 사회초년생 조건 맞춰주셨어요. 보증금 부담 줄이는 시나리오가 있어서 부모님이랑 상의하기 좋았습니다.",
    vehicleHint: "아반떼",
    daysAgo: 10,
    likeCount: 23,
  },
  {
    authorRealName: "윤채아",
    rating: 5,
    content:
      "싼타페 패밀리용으로 봤어요. 트림·옵션 바꾸면 월납이 바로 갱신돼서 가족회의 때 화면 공유만 해도 설명이 됐습니다.",
    vehicleHint: "싼타페",
    daysAgo: 13,
    likeCount: 26,
  },
  {
    authorRealName: "임성호",
    rating: 5,
    content:
      "G80 리스 vs 장기렌트 감 잡기에 딱이었어요. 만기 옵션 설명이 친절하고, 상담 전에 이미 방향을 정해둘 수 있었습니다.",
    vehicleHint: "G80",
    daysAgo: 15,
    likeCount: 28,
    isBest: true,
  },
  {
    authorRealName: "한예슬",
    rating: 5,
    content:
      "스포티지 하이브리드 연비 때문에 골랐는데, 주행거리 조건별 월납 표가 도움이 많이 됐어요. 인도 안내까지 매끄러웠습니다.",
    vehicleHint: "스포티지",
    daysAgo: 17,
    likeCount: 22,
  },
  {
    authorRealName: "오준혁",
    rating: 5,
    content:
      "GV70 견적 비교하다가 여기서 확정했어요. 허위 견적 느낌이 없고 조건이 투명해서 믿음이 갔습니다.",
    vehicleHint: "GV70",
    daysAgo: 19,
    likeCount: 30,
  },
  {
    authorRealName: "신나경",
    rating: 5,
    content:
      "테슬라 모델3 관심 있었는데 다른 국산 전기차랑 나란히 비교할 수 있어서 좋았어요. 월 예산 안에서 후보를 빠르게 줄였습니다.",
    vehicleHint: "Model 3",
    daysAgo: 21,
    likeCount: 19,
  },
  {
    authorRealName: "배성준",
    rating: 5,
    content:
      "X3 외제차도 생각보다 조건이 나와서 놀랐어요. 상담 요청 전에 스스로 시뮬레이션 충분히 해볼 수 있는 게 장점입니다.",
    vehicleHint: "X3",
    daysAgo: 24,
    likeCount: 17,
  },
  {
    authorRealName: "류민아",
    rating: 5,
    content:
      "카니발 하이브리드로 아이 통학용 알아봤어요. 좌석 수랑 월납을 같이 고민할 수 있게 흐름이 잘 짜여 있습니다.",
    vehicleHint: "카니발 HEV",
    daysAgo: 25,
    likeCount: 24,
  },
  {
    authorRealName: "조현민",
    rating: 5,
    content:
      "그랜저 디젤 말고 하이브리드로 갈아타는 계산을 여기서 끝냈어요. 초기비용·월납 트레이드오프가 한눈에 보입니다.",
    vehicleHint: "그랜저",
    daysAgo: 28,
    likeCount: 21,
  },
  {
    authorRealName: "백지원",
    rating: 5,
    content:
      "개인사업자라 비용처리 관점에서 리스/렌트 비교가 필요했는데, 시나리오별로 월 부담이 정리돼 있어서 세무사와 이야기하기 편했어요.",
    vehicleHint: "쏘렌토 HEV",
    daysAgo: 30,
    likeCount: 33,
    isBest: true,
  },
  {
    authorRealName: "남궁현",
    rating: 5,
    content:
      "팰리세이드급 대신 싼타페로 예산 맞춰 골랐어요. AI 추천이 왜 이 차인지 설명해줘서 납득이 됐고 견적도 바로 이어서 봤습니다.",
    vehicleHint: "싼타페 HEV",
    daysAgo: 33,
    likeCount: 20,
  },
  {
    authorRealName: "도예은",
    rating: 5,
    content:
      "C-Class 관심 있어서 월납 감만 보려 했는데, 국산 준대형과 나란히 비교되니까 현실적인 선택이 됐습니다.",
    vehicleHint: "C-Class",
    daysAgo: 36,
    likeCount: 16,
  },
  {
    authorRealName: "석진우",
    rating: 5,
    content:
      "아반떼 하이브리드 연비·월납 둘 다 보고 결정했어요. 화면이 복잡하지 않아서 부모님도 이해하시기 쉬워하셨습니다.",
    vehicleHint: "아반떼 HEV",
    daysAgo: 39,
    likeCount: 18,
  },
  {
    authorRealName: "고유나",
    rating: 5,
    content:
      "견적서 카톡으로 받는 흐름이 편했어요. 나와의 채팅에 정리본이 남으니까 나중에 다시 보기 좋습니다.",
    vehicleHint: "스포티지 HEV",
    daysAgo: 41,
    likeCount: 27,
  },
  {
    authorRealName: "표성민",
    rating: 5,
    content:
      "G90 쪽은 예산이 커서 신중했는데, 조건 바꿔가며 월납 범위를 확인하니 무리 없는 선에서 정리됐습니다. 상담도 강요 없어서 좋았어요.",
    vehicleHint: "G90",
    daysAgo: 44,
    likeCount: 15,
  },
  {
    authorRealName: "연지호",
    rating: 5,
    content:
      "EV6 관심 있었는데 주행거리 연 2만/3만 비교가 핵심이었어요. 여기서 먼저 보고 딜러 방문하니 질문이 명확해졌습니다.",
    vehicleHint: "EV",
    daysAgo: 47,
    likeCount: 23,
  },
  {
    authorRealName: "설아린",
    rating: 5,
    content:
      "아이 둘 있어서 카니발만 봤는데, 월납 시뮬레이션 덕분에 보증금 비중을 합리적으로 정했어요. 만족합니다.",
    vehicleHint: "카니발",
    daysAgo: 50,
    likeCount: 32,
  },
  {
    authorRealName: "마준서",
    rating: 5,
    content:
      "GLC 관심 대비 국산 SUV 월납을 같이 보니 선택 기준이 잡혔어요. 비교 도구로서 완성도가 높습니다.",
    vehicleHint: "GLC",
    daysAgo: 53,
    likeCount: 14,
  },
  {
    authorRealName: "진소율",
    rating: 5,
    content:
      "재계약 앞두고 다른 차 조건 훑어보는데 여기가 제일 빨랐어요. 조건 저장해두고 주말에 가족한테 보여주니 바로 합의가 됐습니다.",
    vehicleHint: "그랜저 HEV",
    daysAgo: 56,
    likeCount: 29,
  },
];

function assertDistribution(list: SeedReview[]) {
  const c3 = list.filter((s) => s.rating === 3).length;
  const c4 = list.filter((s) => s.rating === 4).length;
  const c5 = list.filter((s) => s.rating === 5).length;
  if (list.length !== 40 || c3 !== 2 || c4 !== 15 || c5 !== 23) {
    throw new Error(
      `분포 오류: total=${list.length} (3★=${c3}, 4★=${c4}, 5★=${c5}) — 기대 40 / 2 / 15 / 23`,
    );
  }
}

async function main() {
  assertDistribution(seeds);

  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    select: { id: true, name: true, brand: true },
    orderBy: { displayOrder: "asc" },
  });

  function resolveVehicleId(hint: string): string | null {
    const h = hint.toLowerCase();
    const hit =
      vehicles.find((v) => v.name.toLowerCase().includes(h)) ??
      vehicles.find((v) => `${v.brand} ${v.name}`.toLowerCase().includes(h));
    return hit?.id ?? null;
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const exists = await prisma.review.findFirst({
      where: { authorRealName: s.authorRealName, content: s.content },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() - s.daysAgo);
    // 같은 날 여러 건이면 초 단위로 살짝 분산
    reviewDate.setHours(10 + (i % 8), (i * 7) % 60, i % 60, 0);

    await prisma.review.create({
      data: {
        authorRealName: s.authorRealName,
        rating: s.rating,
        content: s.content,
        vehicleId: resolveVehicleId(s.vehicleHint),
        isPublic: true,
        isBest: s.isBest ?? false,
        displayOrder: 100 + i,
        likeCount: s.likeCount,
        reviewDate,
      },
    });
    created += 1;
  }

  const publicCount = await prisma.review.count({ where: { isPublic: true } });
  const byRating = await prisma.review.groupBy({
    by: ["rating"],
    where: { isPublic: true },
    _count: true,
    orderBy: { rating: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        created,
        skipped,
        publicTotal: publicCount,
        ratingBreakdown: byRating.map((r) => ({
          rating: r.rating,
          count: r._count,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
