import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { z } from "zod"

const ROOT = resolve(import.meta.dirname, "..")
const HARNESS = join(ROOT, "scripts/test-vehicle-image-migration.ts")
const PG_ISREADY = "/opt/homebrew/opt/postgresql@16/bin/pg_isready"
const PREFIX = "vehicle-image-migration-"
const MarkerSchema = z.object({ work: z.string().startsWith(join(tmpdir(), PREFIX)), port: z.number().int().positive(), postgresPid: z.number().int().positive() })
type Marker = z.infer<typeof MarkerSchema>
type TestSignal = "SIGTERM" | "SIGINT"

class InterruptionTestError extends Error { readonly name = "InterruptionTestError" }

function ownedTempDirectories(): ReadonlySet<string> {
  return new Set(readdirSync(tmpdir()).filter((entry) => entry.startsWith(PREFIX)).map((entry) => join(tmpdir(), entry)))
}

function waitForMarker(child: ChildProcess, expectedWork: string): Promise<Marker> {
  return new Promise((resolveMarker, reject) => {
    let output = ""
    const timer = setTimeout(() => reject(new InterruptionTestError("INTERRUPT_READY marker timed out")), 20_000)
    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      output += chunk
      const line = output.split("\n").find((candidate) => candidate.startsWith("INTERRUPT_READY "))
      if (!line) return
      clearTimeout(timer)
      try {
        const marker = MarkerSchema.parse(JSON.parse(line.slice("INTERRUPT_READY ".length)))
        if (marker.work !== expectedWork) throw new InterruptionTestError(`Unexpected owned path: ${marker.work}`)
        resolveMarker(marker)
      } catch (error) { reject(error instanceof Error ? error : new InterruptionTestError("Unknown marker parse failure")) }
    })
    child.once("exit", (code, signal) => {
      clearTimeout(timer)
      reject(new InterruptionTestError(`Harness exited before readiness: code=${code} signal=${signal}`))
    })
  })
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new InterruptionTestError("Launcher did not exit within 5s")), 5_000)
    child.once("close", () => { clearTimeout(timer); resolveExit() })
  })
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false
    throw error
  }
}

function resourcesGone(marker: Marker): boolean {
  const ready = spawnSync(PG_ISREADY, ["-h", "127.0.0.1", "-p", String(marker.port), "-U", "postgres"], { encoding: "utf8", timeout: 2_000 })
  return !existsSync(marker.work) && !pidAlive(marker.postgresPid) && ready.status !== 0
}

async function waitForCleanup(marker: Marker): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (resourcesGone(marker)) return
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  throw new InterruptionTestError(`Resources remain after interruption: ${marker.work}`)
}

function killOwnedGroup(child: ChildProcess): void {
  if (child.pid === undefined) return
  try { process.kill(-child.pid, "SIGKILL") } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error
  }
}

async function verifyInterruption(signal: TestSignal): Promise<void> {
  const before = ownedTempDirectories()
  if (before.size !== 0) throw new InterruptionTestError(`Pre-existing harness temp directories: ${[...before].join(",")}`)
  const runId = randomUUID()
  const expectedWork = join(tmpdir(), `${PREFIX}${runId}`)
  const child = spawn(process.execPath, ["--import", "tsx", HARNESS, "--interrupt-ready"], { cwd: ROOT, detached: true, env: { ...process.env, VEHICLE_IMAGE_MIGRATION_RUN_ID: runId }, stdio: ["ignore", "pipe", "pipe"] })
  let marker: Marker | null = null
  try {
    marker = await waitForMarker(child, expectedWork)
    if (!child.kill(signal)) throw new InterruptionTestError(`Failed to send ${signal} to launcher`)
    await waitForExit(child)
    await waitForCleanup(marker)
    if (ownedTempDirectories().size !== 0) throw new InterruptionTestError(`Temp directory remains after ${signal}`)
    console.log(`PASS interruption=${signal} cleanup=process,listener,tempdir`)
  } finally {
    killOwnedGroup(child)
    if (existsSync(expectedWork)) rmSync(expectedWork, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  await verifyInterruption("SIGTERM")
  await verifyInterruption("SIGINT")
}

main().catch((error: unknown) => { // no-excuse-ok: catch
  console.error(error instanceof Error ? error.message : "Unknown interruption test failure")
  process.exitCode = 1
})
