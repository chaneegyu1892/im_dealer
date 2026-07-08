import { prisma } from "../src/lib/prisma";

type SeedReview = {
  authorRealName: string;
  rating: number;
  content: string;
  vehicleName: string;
  daysAgo: number;
};

const seeds: SeedReview[] = [
  {
    authorRealName: "김도현",
    rating: 5,
    content:
      "처음 장기렌트 알아볼 때 견적 비교가 정말 막막했는데, 아임딜러에서 한 번에 조건별로 정리해줘서 결정이 빨랐어요. 그랜저 36개월 견적 받았고 실제 인도까지 깔끔하게 진행됐습니다.",
    vehicleName: "그랜저",
    daysAgo: 4,
  },
  {
    authorRealName: "이수진",
    rating: 5,
    content:
      "쏘렌토로 가족용 차량 알아보다가 추천받았는데, 보증금/선납금 시뮬레이션이 직관적이었어요. 담당자분도 카톡 응대가 빨라서 좋았습니다. 다음 차도 여기서 알아볼 예정이에요.",
    vehicleName: "쏘렌토",
    daysAgo: 9,
  },
  {
    authorRealName: "박재민",
    rating: 4,
    content:
      "EV6 4년 운용리스로 계약했습니다. 금융사 가산율이 다른 곳보다 낮게 나와서 월납입금 차이가 꽤 컸어요. 다만 출고 대기는 어쩔 수 없더라구요. 그래도 만족합니다.",
    vehicleName: "EV6",
    daysAgo: 14,
  },
  {
    authorRealName: "최유나",
    rating: 5,
    content:
      "아이오닉 5 견적 받고 바로 계약했어요. 다른 업체는 견적이 한참 걸렸는데 여기는 즉시 나오는 게 신기했습니다. 주행거리 조건도 다양해서 비교하기 좋았어요.",
    vehicleName: "아이오닉 5",
    daysAgo: 21,
  },
  {
    authorRealName: "정민호",
    rating: 5,
    content:
      "법인 명의로 카니발 장기렌트 진행했습니다. 사업자 서류 확인부터 인도까지 일주일 만에 끝났어요. 매니저님이 세제 혜택 부분도 꼼꼼히 짚어주셔서 도움 많이 받았습니다.",
    vehicleName: "카니발",
    daysAgo: 27,
  },
  {
    authorRealName: "한지원",
    rating: 4,
    content:
      "GV70 3년 운용리스 견적 받았어요. 회수가치율이 좋게 나와서 월 납입금이 생각보다 합리적이었습니다. 인테리어 컬러 옵션 재고가 좀 부족했던 점은 아쉬웠어요.",
    vehicleName: "GV70",
    daysAgo: 33,
  },
  {
    authorRealName: "강서윤",
    rating: 5,
    content:
      "스포티지 하이브리드로 36개월 계약 완료했습니다. 보증금 30% 조건으로 월납을 많이 낮출 수 있어서 좋았어요. 견적서 이미지로 깔끔하게 받아볼 수 있는 것도 마음에 들었습니다.",
    vehicleName: "스포티지",
    daysAgo: 41,
  },
  {
    authorRealName: "조성훈",
    rating: 5,
    content:
      "팰리세이드로 가족 SUV 갈아탔습니다. 차량 인도 전 출고 대기 동안 임시차량까지 안내해주셔서 불편함이 없었어요. 디테일한 부분까지 챙겨주는 게 인상적이었습니다.",
    vehicleName: "팰리세이드",
    daysAgo: 49,
  },
  {
    authorRealName: "윤하늘",
    rating: 4,
    content:
      "K5 첫 차로 알아봤는데 사회초년생도 가능한 조건들 정리해주셔서 결정이 쉬웠어요. 보증금 없이 선납금 위주로 설계해주신 것도 좋았고, 인도 후 보험 처리도 빨랐습니다.",
    vehicleName: "K5",
    daysAgo: 58,
  },
  {
    authorRealName: "임채영",
    rating: 5,
    content:
      "G80 4년 리스로 진행했습니다. 만기 시 인수/반납 옵션 비교를 명확히 해주셔서 의사결정이 편했어요. 프리미엄 차량 처음이라 걱정 많았는데 친절하게 안내받았습니다.",
    vehicleName: "G80",
    daysAgo: 66,
  },
];

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, name: true },
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.name, v.id] as const));

  let created = 0;
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const vehicleId = vehicleMap.get(s.vehicleName) ?? null;
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() - s.daysAgo);

    await prisma.review.create({
      data: {
        authorRealName: s.authorRealName,
        rating: s.rating,
        content: s.content,
        vehicleId,
        isPublic: true,
        displayOrder: i,
        reviewDate,
      },
    });
    created++;
  }

  const total = await prisma.review.count();
  console.log(`Created ${created} reviews. Total in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
