# 수집 실행 — 점검을 먼저 돌리고 통과하면 워커를 띄운다.
# '수집 시작.bat' 을 더블클릭하면 이 스크립트가 실행된다.

$ErrorActionPreference = "Stop"

# Node 자식 프로세스가 UTF-8 로 출력하므로 콘솔도 UTF-8 로 맞춘다.
# (이게 없으면 doctor 결과의 한글이 깨져서 안내문 역할을 못 한다)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$WorkerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $WorkerDir)
$EnvPath = Join-Path $WorkerDir ".env"

Write-Host ""
Write-Host "===========================================" -ForegroundColor White
Write-Host " 캐피탈사 회수율 수집" -ForegroundColor White
Write-Host "===========================================" -ForegroundColor White

# 새 버전 zip 으로 폴더를 덮어쓰면 .env 가 사라진다 — 폴더 밖 사본에서 자동 복원.
$BackupPath = Join-Path (Join-Path $env:LOCALAPPDATA "imdealer-worker") ".env"
if (-not (Test-Path $EnvPath) -and (Test-Path $BackupPath)) {
    Copy-Item $BackupPath $EnvPath -Force
    Write-Host ""
    Write-Host " 이전 접속 정보를 복원했습니다." -ForegroundColor Green
}

if (-not (Test-Path $EnvPath)) {
    Write-Host ""
    Write-Host "  아직 설치가 되지 않았습니다." -ForegroundColor Red
    Write-Host "  같은 폴더의 '설치하기.bat' 을 먼저 더블클릭해 주세요."
    Write-Host ""
    Read-Host "엔터를 누르면 창이 닫힙니다"
    exit 1
}

# ── 자동 업데이트 ────────────────────────────────────────────
# 서버가 요구하는 버전과 이 폴더의 버전이 다르면, 서버에서 최신 코드를 받아
# 스스로 교체하고 다시 시작한다. 담당자가 zip 을 새로 받을 필요가 없다.
# 실패해도 수집 시작은 막지 않는다 — 버전이 정말 안 맞으면 아래 점검이 잡아준다.
if ($env:IMDEALER_WORKER_UPDATED -ne "1") {
    try {
        # .env 에서 서버 주소·시크릿 읽기 (KEY=VALUE 형식)
        $envMap = @{}
        foreach ($line in Get-Content $EnvPath) {
            if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $envMap[$Matches[1]] = $Matches[2].Trim().Trim('"') }
        }
        # PowerShell 5.1 호환 — ?? 연산자 금지
        # 서버 주소가 쉼표 목록이면(운영·테스트 동시 서빙) 업데이트 확인은 첫 번째 서버로만 한다.
        $apiBase = ((([string]$envMap["WORKER_API_BASE"]) -split ',')[0]).Trim().TrimEnd('/')
        $secret = [string]$envMap["SCRAPER_WORKER_SECRET"]

        $verFile = Join-Path $RepoRoot "src\lib\scraper\worker-version.ts"
        $localVer = [int]([regex]::Match((Get-Content $verFile -Raw), 'WORKER_PROTOCOL_VERSION = (\d+)').Groups[1].Value)

        if ($apiBase -and $secret -and $localVer -gt 0) {
            $pre = Invoke-RestMethod -Uri "$apiBase/api/worker/preflight" -Headers @{ Authorization = "Bearer $secret" } -TimeoutSec 10
            $serverVer = [int]$pre.expectedWorkerVersion

            if ($serverVer -gt 0 -and $serverVer -ne $localVer) {
                Write-Host ""
                Write-Host " 새 버전이 있습니다 (v$localVer -> v$serverVer). 자동 업데이트를 시작합니다..." -ForegroundColor Cyan
                $tmpZip = Join-Path $env:TEMP "imdealer-worker-update.zip"
                $tmpDir = Join-Path $env:TEMP "imdealer-worker-update"
                Invoke-WebRequest -Uri "$apiBase/api/worker/update" -Headers @{ Authorization = "Bearer $secret" } -OutFile $tmpZip -TimeoutSec 120
                if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
                Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
                # 접속 정보(.env)는 zip 에 없으므로 덮어쓰기에서 보존된다
                Copy-Item -Path (Join-Path $tmpDir "*") -Destination $RepoRoot -Recurse -Force
                Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
                Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

                Write-Host " 필요한 구성요소를 설치합니다 (몇 분 걸릴 수 있습니다)..." -ForegroundColor DarkGray
                Push-Location $RepoRoot
                try {
                    & corepack pnpm install
                    & corepack pnpm prisma generate
                } finally { Pop-Location }

                Write-Host " 업데이트 완료 — 새 버전으로 다시 시작합니다." -ForegroundColor Green
                # 이 파일 자체가 새 버전으로 바뀌었을 수 있으므로 새 프로세스로 재실행 (무한루프 방지 플래그)
                $env:IMDEALER_WORKER_UPDATED = "1"
                & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $WorkerDir "run.ps1")
                exit $LASTEXITCODE
            }
        }
    } catch {
        Write-Host ""
        Write-Host " 자동 업데이트 확인을 건너뜁니다 ($($_.Exception.Message))" -ForegroundColor DarkGray
    }
}

Push-Location $RepoRoot
try {
    Write-Host ""
    Write-Host " 연결 상태를 확인합니다..." -ForegroundColor DarkGray
    & corepack pnpm scraper:doctor
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host " 연결에 문제가 있어 시작하지 못했습니다." -ForegroundColor Red
        Write-Host " 위 내용을 화면 캡처해서 개발 담당자에게 보내주세요."
        Write-Host ""
        Read-Host "엔터를 누르면 창이 닫힙니다"
        exit 1
    }

    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " 수집 대기 중" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " 관리자 페이지에서 '회수율 정보 가져오기' 를 누르면"
    Write-Host " 자동으로 수집이 시작됩니다."
    Write-Host ""
    Write-Host " 로그인 창이 뜨면 직접 로그인하신 뒤," -ForegroundColor Yellow
    Write-Host " 관리자 페이지에서 [재개] 를 눌러주세요." -ForegroundColor Yellow
    Write-Host ""
    Write-Host " 끝내려면 이 창을 닫으면 됩니다." -ForegroundColor DarkGray
    Write-Host "-------------------------------------------"

    & corepack pnpm scraper:worker
} finally {
    Pop-Location
}

Write-Host ""
Read-Host "엔터를 누르면 창이 닫힙니다"
