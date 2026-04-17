import Groq from "groq-sdk";

interface ReasonParams {
  industry: string;
  purpose: string;
  budgetMax: number;
  annualMileage: number;
  vehicleName: string;
  brand: string;
  category: string;
  estimatedMonthly: number;
  fallback: string;
}

function buildPrompt(p: ReasonParams): string {
  const budget = Math.round(p.budgetMax / 10000);
  const mileage = Math.round(p.annualMileage / 10000);
  const monthly = Math.round(p.estimatedMonthly / 10000);

  return `당신은 자동차 장기렌트 전문 상담사입니다.

고객 정보:
- 업종/직군: ${p.industry}
- 차량 용도: ${p.purpose}
- 월 예산: ${budget}만원 이하
- 연간 주행: ${mileage}만km

추천 차량: ${p.brand} ${p.vehicleName} (${p.category}), 월납 약 ${monthly}만원

이 고객에게 위 차량을 추천하는 이유를 자연스러운 한국어 2문장으로 작성해주세요.
- 고객의 상황에 공감하는 톤
- 수치 나열 금지, 실생활 와닿는 표현 사용
- 문장 부호 포함 70자 이내
- 반드시 한글만 사용, 한자·영문·특수문자 금지`;
}

let groqClient: Groq | null = null;

function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

export async function generateReason(params: ReasonParams): Promise<string> {
  const client = getGroqClient();
  if (!client) return params.fallback;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: buildPrompt(params) }],
      max_tokens: 120,
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return text.length > 10 ? text : params.fallback;
  } catch (e) {
    console.error("[llm-reason] Groq error:", e);
    return params.fallback;
  }
}
