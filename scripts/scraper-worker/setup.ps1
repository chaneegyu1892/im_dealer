# 스크래퍼 워커 셋업 — 개발 지식 없이 따라갈 수 있도록 만든 대화형 스크립트.
# setup.bat 을 더블클릭하면 이 스크립트가 실행된다.

$ErrorActionPreference = "Stop"

# Node 자식 프로세스가 UTF-8 로 출력하므로 콘솔도 UTF-8 로 맞춘다.
# (이게 없으면 doctor 결과의 한글이 깨져서 안내문 역할을 못 한다)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$WorkerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $WorkerDir)
$EnvPath = Join-Path $WorkerDir ".env"

# 담당자는 zip 으로 새 버전을 받아 폴더를 통째로 덮어쓴다. 그러면 .env 가 사라져
# 접속 정보를 매번 다시 입력해야 하므로, 폴더 밖에 사본을 두고 자동 복원한다.
$BackupDir = Join-Path $env:LOCALAPPDATA "imdealer-worker"
$BackupPath = Join-Path $BackupDir ".env"

if (-not (Test-Path $EnvPath) -and (Test-Path $BackupPath)) {
    Copy-Item $BackupPath $EnvPath -Force
    Write-Host "  이전에 저장한 접속 정보를 복원했습니다." -ForegroundColor Green
}

function Write-Step($n, $text) { Write-Host "`n[$n] $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  OK   $text" -ForegroundColor Green }
function Write-Fail($text) { Write-Host "  실패 $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host "       $text" -ForegroundColor DarkGray }

function Stop-WithMessage($text) {
    Write-Host ""
    Write-Fail $text
    Write-Host ""
    Read-Host "엔터를 누르면 창이 닫힙니다"
    exit 1
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor White
Write-Host " 캐피탈사 회수율 수집 프로그램 설치" -ForegroundColor White
Write-Host "===========================================" -ForegroundColor White
Write-Host " 이 창을 닫지 말고 안내를 따라와 주세요."

# ── 1. Node.js ──────────────────────────────────────────────
Write-Step 1 "Node.js 확인"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Fail "Node.js 가 설치되어 있지 않습니다."
    Write-Info "https://nodejs.org 에서 왼쪽 'LTS' 버튼으로 설치한 뒤,"
    Write-Info "이 창을 닫고 setup.bat 을 다시 실행해 주세요."
    Start-Process "https://nodejs.org"
    Stop-WithMessage "Node.js 설치가 필요합니다."
}
$nodeVersionText = (& node -v).TrimStart("v")
$nodeVersion = [version]$nodeVersionText
$minimumNodeVersion = [version]"22.13.0"
if ($nodeVersion -lt $minimumNodeVersion) {
    Write-Fail "Node.js 버전이 낮습니다 (현재 $nodeVersionText, 22.13 이상 필요)"
    Write-Info "https://nodejs.org 에서 최신 LTS 로 다시 설치해 주세요."
    Start-Process "https://nodejs.org"
    Stop-WithMessage "Node.js 업그레이드가 필요합니다."
}
Write-Ok "Node.js $nodeVersionText"

# ── 2. 필요한 파일 설치 ─────────────────────────────────────
Write-Step 2 "필요한 파일 설치 (수 분 걸릴 수 있습니다)"
Push-Location $RepoRoot
try {
    & corepack enable 2>&1 | Out-Null
    Write-Info "패키지를 내려받는 중..."
    & corepack pnpm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage "패키지 설치에 실패했습니다. 인터넷 연결을 확인해 주세요." }
    Write-Info "데이터베이스 연결 준비 중..."
    & corepack pnpm prisma generate 2>&1 | Out-Null
    Write-Ok "설치 완료"
} finally {
    Pop-Location
}

# ── 3. 브라우저 찾기 ────────────────────────────────────────
Write-Step 3 "브라우저 확인"
$browserCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browserPath = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browserPath) {
    Write-Ok "$(Split-Path -Leaf $browserPath) 사용"
} else {
    Write-Fail "Chrome 또는 Edge 를 찾지 못했습니다."
    Write-Info "Chrome 을 설치한 뒤 다시 실행해 주세요."
    Start-Process "https://www.google.com/chrome/"
    Stop-WithMessage "브라우저 설치가 필요합니다."
}

# ── 4. 접속 정보 ────────────────────────────────────────────
Write-Step 4 "접속 정보 입력"

$keepExisting = $false
if (Test-Path $EnvPath) {
    Write-Host "  이미 설정된 접속 정보가 있습니다."
    $answer = Read-Host "  그대로 사용할까요? (Y = 그대로 / N = 새로 입력)"
    if ($answer -notmatch '^[Nn]') { $keepExisting = $true }
}

if (-not $keepExisting) {
    Write-Host ""
    Write-Host "  아래 3가지는 개발 담당자에게 받아서 그대로 붙여넣으세요." -ForegroundColor Yellow
    Write-Host "  (마우스 오른쪽 클릭으로 붙여넣기가 됩니다)" -ForegroundColor DarkGray
    Write-Host ""

    $apiBase = Read-Host "  1) 서버 주소"
    if (-not $apiBase) { Stop-WithMessage "서버 주소를 입력해야 합니다." }

    $workerSecret = Read-Host "  2) 워커 비밀키" -AsSecureString
    if ($workerSecret.Length -eq 0) { Stop-WithMessage "워커 비밀키를 입력해야 합니다." }

    $piiKey = Read-Host "  3) 암호화 키" -AsSecureString
    if ($piiKey.Length -eq 0) { Stop-WithMessage "암호화 키를 입력해야 합니다." }

    $workerSecretPointer = [IntPtr]::Zero
    $piiKeyPointer = [IntPtr]::Zero
    try {
        $workerSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($workerSecret)
        $piiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($piiKey)
        $lines = @(
            "# 이 파일에는 비밀키가 들어 있습니다. 다른 사람에게 보내지 마세요.",
            "WORKER_API_BASE=$($apiBase.Trim())",
            "SCRAPER_WORKER_SECRET=$([Runtime.InteropServices.Marshal]::PtrToStringBSTR($workerSecretPointer).Trim())",
            "PII_ENCRYPTION_KEY=$([Runtime.InteropServices.Marshal]::PtrToStringBSTR($piiKeyPointer).Trim())",
            "PUPPETEER_EXECUTABLE_PATH=$browserPath",
            "SCRAPER_HEADFUL=true"
        )
        Set-Content -Path $EnvPath -Value $lines -Encoding UTF8
    } finally {
        $lines = $null
        if ($workerSecretPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($workerSecretPointer)
        }
        if ($piiKeyPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($piiKeyPointer)
        }
    }
    Write-Ok "접속 정보를 저장했습니다."
}

# 다음에 새 버전 zip 으로 덮어써도 잃지 않도록 폴더 밖에 사본을 남긴다.
if (Test-Path $EnvPath) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    Copy-Item $EnvPath $BackupPath -Force
}

# ── 5. 점검 ────────────────────────────────────────────────
Write-Step 5 "연결 점검"
Push-Location $RepoRoot
try {
    & corepack pnpm scraper:doctor
    $doctorFailed = ($LASTEXITCODE -ne 0)
} finally {
    Pop-Location
}

Write-Host ""
if ($doctorFailed) {
    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " 설정에 문제가 있습니다" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red
    Write-Host " 위에 빨간색으로 표시된 항목을 개발 담당자에게"
    Write-Host " 그대로 전달해 주세요. 화면을 캡처해서 보내면 가장 빠릅니다."
} else {
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " 설치 완료" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host " 이제부터는 '수집 시작.bat' 을 더블클릭하면 됩니다."
    Write-Host " 이 설치 과정은 다시 하지 않아도 됩니다."
}
Write-Host ""
Read-Host "엔터를 누르면 창이 닫힙니다"
