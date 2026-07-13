import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { assertVehicleImageE2ERuntime } from "./e2e-runtime";

export class FilesystemE2EStorageError extends Error {
  readonly name = "FilesystemE2EStorageError";

  constructor(readonly code: "INVALID_E2E_STORAGE_PATH" | "E2E_STORAGE_WRITE_FAILED", cause?: unknown) {
    super(code, { cause });
  }
}

type BinaryObject = { readonly arrayBuffer: () => Promise<ArrayBuffer> };

function ownedPath(root: string, storagePath: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(storagePath) || storagePath.startsWith("/") || storagePath.split("/").includes("..")) {
    throw new FilesystemE2EStorageError("INVALID_E2E_STORAGE_PATH");
  }
  const target = resolve(root, storagePath);
  if (!target.startsWith(`${root}${sep}`)) {
    throw new FilesystemE2EStorageError("INVALID_E2E_STORAGE_PATH");
  }
  return target;
}

export async function uploadFilesystemVehicleImage(params: {
  readonly path: string;
  readonly file: BinaryObject;
  readonly environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const runtime = assertVehicleImageE2ERuntime(params.environment ?? process.env);
  const target = ownedPath(runtime.storageRoot, params.path);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, new Uint8Array(await params.file.arrayBuffer()), { flag: "wx" });
  } catch (error) {
    throw new FilesystemE2EStorageError("E2E_STORAGE_WRITE_FAILED", error);
  }
  return `${runtime.storageBaseUrl}/${params.path}`;
}

export async function deleteFilesystemVehicleImage(
  storagePath: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const runtime = assertVehicleImageE2ERuntime(environment);
  await rm(ownedPath(runtime.storageRoot, storagePath), { force: true });
}
