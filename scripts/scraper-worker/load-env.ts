// .env 로딩 전용 사이드이펙트 모듈.
// ESM import 호이스팅 때문에 다른 모듈(api-client 등)이 모듈 최상위에서
// process.env 를 읽기 전에 반드시 이 모듈이 가장 먼저 import 되어야 한다.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });
