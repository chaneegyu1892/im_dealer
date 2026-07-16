import { createServer } from "node:http";

/**
 * 스크래퍼 테스트용 가짜 캐피탈사 사이트 (의존성 없음, `node server.mjs` 로 실행).
 *
 * 시뮬레이트:
 *  - /login        : ID/PW 폼 (#username, #password, #login-btn)
 *  - POST /login   : 세션 쿠키 발급 후 /dashboard 리다이렉트
 *  - /dashboard    : 세션 연장 버튼(#extend-btn). N초 미사용 시 세션 만료.
 *  - /extend       : 세션 만료 시각 갱신
 *  - /quote?trim=  : 트림별 견적 표. 세션 만료 시 /login 으로 리다이렉트.
 *
 * 목적: 로그인 + keepAlive(타임아웃 넘겨 세션 생존) + scrapeTrim + draft 보고를
 *       실제 사이트/약관을 건드리지 않고 e2e 검증.
 */

const PORT = Number(process.env.MOCK_PORT ?? 4599);
const SESSION_TTL_MS = Number(process.env.MOCK_SESSION_TTL_MS ?? 8000); // 8초 후 만료
const USER = process.env.MOCK_USER ?? "tester";
const PASS = process.env.MOCK_PASS ?? "secret";

const sessions = new Map(); // sid -> expiresAt(ms)
let counter = 0;

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k) out[k] = v;
  }
  return out;
}

function valid(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return false;
  const exp = sessions.get(sid);
  if (!exp || exp < Date.now()) return false;
  return true;
}

function ratesFor(code) {
  // 코드 문자열을 시드로 결정적 가짜 견적 생성
  const seed = [...code].reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 450000 + (seed % 10) * 12000;
  const months = [36, 48, 60];
  const miles = [10000, 20000, 30000];
  const cells = [];
  months.forEach((m, mi) =>
    miles.forEach((km, ki) => {
      const v = base + mi * 28000 + ki * 16000;
      cells.push(`<td data-rate="base" data-key="${m}_${km}">${v.toLocaleString("en-US")}</td>`);
    })
  );
  const price = 33000000 + (seed % 7) * 1500000;
  return { cells: cells.join(""), price, deposit: base - 22000, prepay: base + 9000 };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, html, headers = {}) => {
    res.writeHead(code, { "content-type": "text/html; charset=utf-8", ...headers });
    res.end(html);
  };

  if (url.pathname === "/login" && req.method === "GET") {
    return send(
      200,
      `<!doctype html><meta charset=utf-8><title>로그인</title>
       <form method=post action=/login>
         <input id=username name=username placeholder=ID>
         <input id=password name=password type=password placeholder=PW>
         <button id=login-btn type=submit>로그인</button>
       </form>`
    );
  }

  if (url.pathname === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const p = new URLSearchParams(body);
      if (p.get("username") === USER && p.get("password") === PASS) {
        const sid = `s${++counter}`;
        sessions.set(sid, Date.now() + SESSION_TTL_MS);
        send(302, "", { "set-cookie": `sid=${sid}; Path=/`, location: "/dashboard" });
      } else {
        send(401, "로그인 실패");
      }
    });
    return;
  }

  if (url.pathname === "/dashboard") {
    if (!valid(req)) return send(302, "", { location: "/login" });
    return send(
      200,
      `<!doctype html><meta charset=utf-8><title>대시보드</title>
       <button id=extend-btn onclick="fetch('/extend',{method:'POST'})">연장</button>
       <p>로그인됨</p>`
    );
  }

  if (url.pathname === "/extend" && req.method === "POST") {
    const sid = parseCookies(req).sid;
    if (sid && sessions.has(sid)) sessions.set(sid, Date.now() + SESSION_TTL_MS);
    return send(valid(req) ? 200 : 401, "ok");
  }

  if (url.pathname === "/quote") {
    if (!valid(req)) return send(302, "", { location: "/login" });
    const code = url.searchParams.get("trim") ?? "UNKNOWN";
    const { cells, price, deposit, prepay } = ratesFor(code);
    return send(
      200,
      `<!doctype html><meta charset=utf-8><title>견적 ${code}</title>
       <div data-field="trimLabel">${code} 트림</div>
       <div data-field="vehiclePrice">${price.toLocaleString("en-US")}</div>
       <table><tr>${cells}</tr></table>
       <span data-rate="deposit" data-key="36_10000">${deposit.toLocaleString("en-US")}</span>
       <span data-rate="prepay" data-key="36_10000">${prepay.toLocaleString("en-US")}</span>`
    );
  }

  send(404, "not found");
});

server.listen(PORT, () => {
  console.log(`[mock-site] http://localhost:${PORT} (login ${USER}/${PASS}, 세션 TTL ${SESSION_TTL_MS}ms)`);
});
