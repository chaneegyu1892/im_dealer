import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { VehicleImageOrigin, VehicleImageStorageCleanupReason, VehicleImageStorageCleanupStatus } from "@prisma/client"
import { assertDockerCleanup, installCleanupHandlers, OwnedCleanup, verifyCleanupSelfTest } from "./vehicle-image-migration-cleanup"

const ROOT = resolve(import.meta.dirname, "..")
const MIGRATION = "20260712000000_add_vehicle_image_management_state"
const PRISMA = join(ROOT, "node_modules/.bin/prisma")
const PG_BIN = "/opt/homebrew/opt/postgresql@16/bin"

type CommandOptions = { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv; readonly timeoutMs?: number }
type CommandResult = { readonly status: number; readonly stdout: string; readonly stderr: string }
type DatabaseRuntime = { readonly local: boolean; readonly port: number; readonly container: string; readonly data: string }
type SqlCheck = { readonly statement: string; readonly expected: string }

class CommandError extends Error {
  readonly name = "CommandError"
  constructor(readonly command: string, readonly result: CommandResult) {
    super(`${command} failed (${result.status}): ${result.stderr || result.stdout}`)
  }
}

class ContractError extends Error { readonly name = "ContractError" }

const ownedCleanup = new OwnedCleanup()
installCleanupHandlers(ownedCleanup)

function probe(command: string, args: readonly string[], options: CommandOptions = {}): CommandResult {
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: "utf8", env: options.env, timeout: options.timeoutMs ?? 30_000 })
  return { status: result.error ? 127 : (result.status ?? 1), stdout: result.stdout, stderr: result.error?.message ?? result.stderr }
}

function run(command: string, args: readonly string[], options: CommandOptions = {}): string {
  const result = probe(command, args, options)
  if (result.status !== 0) throw new CommandError(`${command} ${args.join(" ")}`, result)
  return result.stdout.trim()
}

function assertIncludes(text: string, expected: string, label: string): void {
  if (!text.includes(expected)) throw new ContractError(`${label} missing: ${expected}`)
}

function migrationRunId(): string {
  const requested = process.env["VEHICLE_IMAGE_MIGRATION_RUN_ID"]
  if (requested === undefined) return randomUUID()
  if (!/^[0-9a-f-]{36}$/.test(requested)) throw new ContractError("Migration run ID is invalid")
  return requested
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || address === null) { server.close(); reject(new ContractError("Unable to allocate loopback port")); return }
      server.close((error) => error ? reject(error) : resolvePort(address.port))
    })
  })
}

async function waitForPostgres(database: DatabaseRuntime): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const ready = database.local
      ? probe(join(PG_BIN, "pg_isready"), ["-h", "127.0.0.1", "-p", String(database.port), "-U", "postgres"])
      : probe("docker", ["exec", database.container, "pg_isready", "-U", "postgres"])
    if (ready.status === 0) return
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new ContractError("PostgreSQL readiness timed out after 30s")
}

function copyBaseMigrations(target: string): void {
  const targetPrisma = join(target, "prisma")
  mkdirSync(join(targetPrisma, "migrations"), { recursive: true })
  const current = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")
  const baseline = current
    .replace("  thumbnailImageId       String?               @unique\n", "").replace("  imageRevision          Int                   @default(0)\n", "").replace("  // DB FK proves image existence only; API/policy must enforce thumbnailImage.vehicleId == Vehicle.id.\n  thumbnailImage         VehicleImage?         @relation(\"VehicleRepresentativeImage\", fields: [thumbnailImageId], references: [id], onDelete: SetNull)\n", "")
    .replace(/\nenum VehicleImageOrigin \{[\s\S]*?\n\}\n\nmodel VehicleColor/, "\nmodel VehicleColor").replace("  origin           VehicleImageOrigin @default(CARPAN2)\n", "").replace("  adminStoragePath String?            @unique\n", "").replace("  deletedAt        DateTime?\n", "")
    .replace("  representativeOf Vehicle? @relation(\"VehicleRepresentativeImage\")\n", "").replace(/\nmodel VehicleImageStorageCleanup \{[\s\S]*?\n\}\n\nmodel SavedQuote/, "\nmodel SavedQuote")
  const schemaPath = join(targetPrisma, "schema.prisma")
  writeFileSync(schemaPath, baseline)
  const baselineSql = run(PRISMA, ["migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"], { cwd: ROOT, timeoutMs: 60_000 })
  const baselineMigration = join(targetPrisma, "migrations/20260711000000_disposable_schema_baseline")
  mkdirSync(baselineMigration)
  writeFileSync(join(baselineMigration, "migration.sql"), baselineSql)
  writeFileSync(schemaPath, current)
  cpSync(join(ROOT, "prisma/migrations/migration_lock.toml"), join(targetPrisma, "migrations/migration_lock.toml"))
}

function addCurrentMigration(target: string, broken: boolean): void {
  const source = join(ROOT, "prisma/migrations", MIGRATION)
  const destination = join(target, "prisma/migrations", MIGRATION)
  cpSync(source, destination, { recursive: true })
  if (broken) appendFileSync(join(destination, "migration.sql"), '\nSELECT * FROM "__deliberately_missing_table__";\n')
}

function migrationEnv(runtime: DatabaseRuntime, database: string): NodeJS.ProcessEnv {
  const credentials = runtime.local ? "postgres" : "postgres:vehicle_images"
  const url = `postgresql://${credentials}@127.0.0.1:${runtime.port}/${database}`
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url }
}

function deploy(fixture: string, env: NodeJS.ProcessEnv): CommandResult {
  return probe(PRISMA, ["migrate", "deploy", "--schema", join(fixture, "prisma/schema.prisma")], { cwd: ROOT, env })
}

function sql(runtime: DatabaseRuntime, database: string, statement: string): CommandResult {
  return runtime.local
    ? probe(join(PG_BIN, "psql"), ["-h", "127.0.0.1", "-p", String(runtime.port), "-U", "postgres", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", statement])
    : probe("docker", ["exec", runtime.container, "psql", "-U", "postgres", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", statement])
}

function assertSql(runtime: DatabaseRuntime, database: string, check: SqlCheck): void {
  const result = sql(runtime, database, check.statement)
  if (result.status !== 0) throw new CommandError("psql catalog readback", result)
  assertIncludes(result.stdout.trim(), check.expected, "database readback")
}

async function startRuntime(runtime: DatabaseRuntime, markStarted: () => void): Promise<string> {
  if (runtime.local) {
    const version = run(join(PG_BIN, "postgres"), ["--version"])
    run(join(PG_BIN, "initdb"), ["-D", runtime.data, "--username", "postgres", "--auth", "trust", "--no-locale", "--encoding", "UTF8"])
    markStarted()
    run(join(PG_BIN, "pg_ctl"), ["-D", runtime.data, "-l", join(runtime.data, "postgres.log"), "-o", `-h 127.0.0.1 -p ${runtime.port}`, "-w", "-t", "20", "start"])
    await waitForPostgres(runtime)
    for (const database of ["migration_real", "migration_negative"]) run(join(PG_BIN, "createdb"), ["-h", "127.0.0.1", "-p", String(runtime.port), "-U", "postgres", database])
    return version
  }
  const version = run("docker", ["version", "--format", "{{.Server.Version}}"])
  markStarted()
  run("docker", ["run", "--detach", "--name", runtime.container, "--publish", `127.0.0.1:${runtime.port}:5432`, "--env", "POSTGRES_PASSWORD=vehicle_images", "--env", "POSTGRES_DB=migration_real", "postgres:16-alpine"])
  await waitForPostgres(runtime)
  run("docker", ["exec", runtime.container, "createdb", "-U", "postgres", "migration_negative"])
  return version
}

function cleanupRuntime(runtime: DatabaseRuntime, work: string, started: boolean): void {
  try {
    if (started && runtime.local) {
      const before = probe(join(PG_BIN, "pg_ctl"), ["-D", runtime.data, "status"])
      if (before.status === 0) {
        const stopped = probe(join(PG_BIN, "pg_ctl"), ["-D", runtime.data, "-m", "immediate", "-w", "-t", "20", "stop"])
        if (stopped.status !== 0) throw new CommandError("pg_ctl stop", stopped)
      } else if (before.status !== 3) throw new CommandError("pg_ctl pre-cleanup status", before)
      const status = probe(join(PG_BIN, "pg_ctl"), ["-D", runtime.data, "status"])
      if (status.status !== 3) throw new ContractError(`PostgreSQL remains after cleanup: ${status.stdout || status.stderr}`)
    } else if (started) {
      assertDockerCleanup(probe("docker", ["rm", "--force", runtime.container]), probe("docker", ["ps", "--all", "--filter", `name=^/${runtime.container}$`, "--format", "{{.Names}}"] ))
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  if (existsSync(work)) throw new ContractError(`Temporary directory remains after cleanup: ${work}`)
}

function verifyStaticContract(): void {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")
  const migrationPath = join(ROOT, "prisma/migrations", MIGRATION, "migration.sql")
  for (const expected of ["enum VehicleImageOrigin", "origin           VehicleImageOrigin", "thumbnailImageId", "imageRevision", "VehicleImageStorageCleanup", "adminStoragePath", "deletedAt"]) assertIncludes(schema, expected, "schema contract")
  assertIncludes(schema, "API/policy", "cross-vehicle ownership enforcement comment")
  if (!existsSync(migrationPath)) throw new ContractError(`Required migration missing: ${basename(migrationPath)}`)
  const migration = readFileSync(migrationPath, "utf8")
  for (const expected of ["VehicleImageOrigin", "CARPAN2", "adminStoragePath", "thumbnailImageId", "imageRevision", "VehicleImageStorageCleanup", "ON DELETE SET NULL"]) assertIncludes(migration, expected, "migration contract")
  assertIncludes(Object.values(VehicleImageOrigin).join(","), "CARPAN2,ADMIN", "generated origin literals")
  assertIncludes(Object.values(VehicleImageStorageCleanupReason).join(","), "UPLOAD_ROLLBACK,IMAGE_PURGE,VEHICLE_DELETE", "generated cleanup reason literals")
  assertIncludes(Object.values(VehicleImageStorageCleanupStatus).join(","), "RESERVED,READY,PROCESSING", "generated cleanup status literals")
}

async function main(): Promise<void> {
  verifyStaticContract()
  const port = await freePort()
  const work = join(tmpdir(), `vehicle-image-migration-${migrationRunId()}`)
  const runtime = { local: existsSync(join(PG_BIN, "postgres")), port, container: `vehicle-image-migration-${randomUUID()}`, data: join(work, "pgdata") } satisfies DatabaseRuntime
  let started = false
  let passReceipt = ""
  ownedCleanup.register(() => cleanupRuntime(runtime, work, started))
  mkdirSync(work)
  try {
    const version = await startRuntime(runtime, () => { started = true })
    if (process.argv.includes("--interrupt-ready")) {
      const postgresPid = Number(readFileSync(join(runtime.data, "postmaster.pid"), "utf8").split("\n")[0])
      if (!Number.isInteger(postgresPid)) throw new ContractError("PostgreSQL PID marker is invalid")
      console.log(`INTERRUPT_READY ${JSON.stringify({ work, port, postgresPid })}`)
      await new Promise(() => setInterval(() => undefined, 1_000))
    }
    const base = join(work, "base")
    const current = join(work, "current")
    const broken = join(work, "broken")
    for (const fixture of [base, current, broken]) copyBaseMigrations(fixture)
    addCurrentMigration(current, false)
    addCurrentMigration(broken, true)
    for (const database of ["migration_real", "migration_negative"]) {
      const baseResult = deploy(base, migrationEnv(runtime, database))
      if (baseResult.status !== 0) throw new CommandError(`base migrate deploy (${database})`, baseResult)
      const seed = sql(runtime, database, `INSERT INTO "Vehicle" (id,slug,name,brand,category,"basePrice","thumbnailUrl","imageUrls",tags,"updatedAt") VALUES ('legacy-vehicle','legacy','Legacy','Brand','SUV',1,'legacy-thumb',ARRAY['legacy-a','legacy-b'],ARRAY[]::TEXT[],CURRENT_TIMESTAMP); INSERT INTO "VehicleImage" (id,"vehicleId",type,"storageUrl","sourceKey","updatedAt") VALUES ('legacy-image','legacy-vehicle','MAIN','legacy-storage','legacy-source',CURRENT_TIMESTAMP);`)
      if (seed.status !== 0) throw new CommandError(`legacy fixture (${database})`, seed)
    }
    const negative = deploy(broken, migrationEnv(runtime, "migration_negative"))
    if (negative.status === 0) throw new ContractError("Deliberately broken migration unexpectedly succeeded")
    assertIncludes(`${negative.stdout}\n${negative.stderr}`, "__deliberately_missing_table__", "negative migration fixture")
    const real = deploy(current, migrationEnv(runtime, "migration_real"))
    if (real.status !== 0) throw new CommandError("current migrate deploy", real)
    assertSql(runtime, "migration_real", { statement: `SELECT "origin"::text,"deletedAt" IS NULL,"adminStoragePath" IS NULL FROM "VehicleImage" WHERE id='legacy-image'`, expected: "CARPAN2|t|t" })
    assertSql(runtime, "migration_real", { statement: `SELECT "thumbnailUrl",array_to_string("imageUrls",','),"thumbnailImageId" IS NULL FROM "Vehicle" WHERE id='legacy-vehicle'`, expected: "legacy-thumb|legacy-a,legacy-b|t" })
    assertSql(runtime, "migration_real", { statement: `SELECT "imageRevision" FROM "Vehicle" WHERE id='legacy-vehicle'`, expected: "0" })
    assertSql(runtime, "migration_real", { statement: `SELECT column_default FROM information_schema.columns WHERE table_name='Vehicle' AND column_name='imageRevision'`, expected: "0" })
    assertSql(runtime, "migration_real", { statement: `SELECT count(*) FROM "VehicleImageStorageCleanup"`, expected: "0" })
    assertSql(runtime, "migration_real", { statement: `SELECT string_agg(enumlabel,',' ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname='VehicleImageOrigin'`, expected: "CARPAN2,ADMIN" })
    assertSql(runtime, "migration_real", { statement: `SELECT string_agg(enumlabel,',' ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname='VehicleImageStorageCleanupReason'`, expected: "UPLOAD_ROLLBACK,IMAGE_PURGE,VEHICLE_DELETE" })
    assertSql(runtime, "migration_real", { statement: `SELECT string_agg(enumlabel,',' ORDER BY enumsortorder) FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname='VehicleImageStorageCleanupStatus'`, expected: "RESERVED,READY,PROCESSING" })
    assertSql(runtime, "migration_real", { statement: `SELECT string_agg(column_name||':'||is_nullable,',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name='VehicleImageStorageCleanup'`, expected: "id:NO,storagePath:NO,reason:NO,status:NO,reservationToken:YES,availableAt:NO,leaseToken:YES,leaseExpiresAt:YES,attempts:NO,lastError:YES,createdAt:NO,updatedAt:NO" })
    assertSql(runtime, "migration_real", { statement: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='Vehicle_thumbnailImageId_fkey'`, expected: "ON DELETE SET NULL" })
    assertSql(runtime, "migration_real", { statement: `SELECT indexdef FROM pg_indexes WHERE indexname='VehicleImage_adminStoragePath_key'`, expected: "UNIQUE INDEX" })
    assertSql(runtime, "migration_real", { statement: `SELECT indexdef FROM pg_indexes WHERE indexname='VehicleImageStorageCleanup_storagePath_key'`, expected: "UNIQUE INDEX" })
    assertSql(runtime, "migration_real", { statement: `SELECT column_default FROM information_schema.columns WHERE table_name='VehicleImage' AND column_name='origin'`, expected: "CARPAN2" })
    assertSql(runtime, "migration_real", { statement: `INSERT INTO "VehicleImageStorageCleanup" (id,"storagePath",reason,"updatedAt") VALUES ('cleanup','admin/path','UPLOAD_ROLLBACK',CURRENT_TIMESTAMP) RETURNING status::text,attempts,"availableAt" IS NOT NULL`, expected: "RESERVED|0|t" })
    assertSql(runtime, "migration_real", { statement: `UPDATE "Vehicle" SET "thumbnailImageId"='legacy-image' WHERE id='legacy-vehicle'; DELETE FROM "VehicleImage" WHERE id='legacy-image'; SELECT "thumbnailImageId" IS NULL FROM "Vehicle" WHERE id='legacy-vehicle'`, expected: "t" })
    passReceipt = `PASS negative_fixture_exit=${negative.status} postgres=${version} legacy_preserved=true set_null=true`
  } finally {
    ownedCleanup.run()
  }
  console.log(`CLEANUP runtime=${runtime.local ? "local" : "docker"} remaining=0 tempdir=removed`)
  console.log(passReceipt)
}

async function runEntry(): Promise<void> {
  if (process.argv.includes("--self-test")) { verifyCleanupSelfTest(); return }
  if (process.argv.includes("--static")) { verifyStaticContract(); return }
  await main()
}

runEntry().catch((error: unknown) => { // no-excuse-ok: catch
  console.error(error instanceof Error ? error.message : "Unknown migration harness failure")
  process.exitCode = 1
})
