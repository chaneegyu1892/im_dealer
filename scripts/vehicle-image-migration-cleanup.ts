import { spawnSync } from "node:child_process"

type CleanupAction = () => void
type CleanupState = "idle" | "running" | "done"
type CommandResult = { readonly status: number; readonly stdout: string; readonly stderr: string }

const SIGNAL_EXIT_CODE = { SIGINT: 130, SIGTERM: 143 } as const satisfies Readonly<Record<"SIGINT" | "SIGTERM", number>>

class CleanupLifecycleError extends Error { readonly name = "CleanupLifecycleError" }
class CleanupCommandError extends Error {
  readonly name = "CleanupCommandError"
  constructor(readonly command: string, readonly result: CommandResult) { super(`${command} failed (${result.status}): ${result.stderr || result.stdout}`) }
}

export function assertDockerCleanup(removed: CommandResult, remaining: CommandResult): void {
  if (removed.status !== 0) throw new CleanupCommandError("docker rm --force", removed)
  if (remaining.status !== 0) throw new CleanupCommandError("docker ps cleanup readback", remaining)
  if (remaining.stdout.trim() !== "") throw new CleanupLifecycleError(`Container remains after cleanup: ${remaining.stdout.trim()}`)
}

export function verifyCleanupSelfTest(): void {
  const timeout = spawnSync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { encoding: "utf8", timeout: 25 })
  if (!timeout.error?.message.includes("ETIMEDOUT")) throw new CleanupLifecycleError("Hung command timeout was not enforced")
  const clean = { status: 0, stdout: "", stderr: "" } satisfies CommandResult
  for (const [removed, remaining] of [[{ status: 1, stdout: "", stderr: "rm failure" }, clean], [clean, { status: 1, stdout: "", stderr: "ps failure" }], [clean, { status: 0, stdout: "named-container", stderr: "" }]] satisfies readonly (readonly [CommandResult, CommandResult])[]) {
    let rejected = false
    try { assertDockerCleanup(removed, remaining) } catch (error) { if (!(error instanceof Error)) throw error; rejected = true }
    if (!rejected) throw new CleanupLifecycleError("Cleanup failure was not rejected")
  }
  const owner = new OwnedCleanup()
  let calls = 0
  owner.register(() => { calls += 1; if (owner.run()) throw new CleanupLifecycleError("Reentrant cleanup was accepted") })
  if (!owner.run() || !owner.run() || calls !== 1) throw new CleanupLifecycleError("Cleanup is not idempotent")
  console.log("PASS self_test=hung_command_timeout,cleanup_failures,idempotent,reentrant")
}

export class OwnedCleanup {
  #action: CleanupAction | null = null
  #state: CleanupState = "idle"

  register(action: CleanupAction): void {
    if (this.#action !== null || this.#state !== "idle") throw new CleanupLifecycleError("Cleanup ownership is already registered")
    this.#action = action
  }

  run(): boolean {
    if (this.#state === "done") return true
    if (this.#state === "running") return false
    this.#state = "running"
    try {
      this.#action?.()
      this.#state = "done"
      return true
    } catch (error) {
      this.#state = "idle"
      throw error
    }
  }
}

export function installCleanupHandlers(owner: OwnedCleanup): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      try {
        if (!owner.run()) return
        process.exit(SIGNAL_EXIT_CODE[signal])
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Unknown interruption cleanup failure")
        process.exit(1)
      }
    })
  }
  process.on("exit", () => { owner.run() })
}
