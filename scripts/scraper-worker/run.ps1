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

if (-not (Test-Path $EnvPath)) {
    Write-Host ""
    Write-Host "  아직 설치가 되지 않았습니다." -ForegroundColor Red
    Write-Host "  같은 폴더의 '설치하기.bat' 을 먼저 더블클릭해 주세요."
    Write-Host ""
    Read-Host "엔터를 누르면 창이 닫힙니다"
    exit 1
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
