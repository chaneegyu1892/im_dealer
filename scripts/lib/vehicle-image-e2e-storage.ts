import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve, sep } from "node:path";
import type { VehicleImageE2EHarness } from "./vehicle-image-e2e-harness";

export function startStorageServer(harness: VehicleImageE2EHarness): Server {
  const base = new URL(harness.environment.VEHICLE_IMAGE_STORAGE_BASE_URL ?? "");
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/auth/v1/admin/users")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ users: [], aud: "", next_page: null, last_page: 0, total: 0 }));
      return;
    }
    if (!request.url?.startsWith("/storage/")) { response.writeHead(404).end(); return; }
    const path = resolve(harness.storageRoot, decodeURIComponent(request.url.slice("/storage/".length)));
    if (!path.startsWith(`${harness.storageRoot}${sep}`) || !existsSync(path)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    const stream = createReadStream(path);
    stream.once("error", () => {
      if (response.headersSent) response.destroy();
      else response.writeHead(404).end();
    });
    stream.pipe(response);
  });
  server.listen(Number(base.port), "127.0.0.1");
  return server;
}
