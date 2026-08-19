#!/usr/bin/env bash
# 네트워크에 의존하는 설치 명령을 "시도당 시간제한 + 재시도" 로 감싼다.
#
# apt 미러가 응답을 멈추면 기본 설정으로는 끝없이 매달린다. 2026-08-19 CI 에서
# archive.ubuntu.com 이 멈추면서 E2E 두 잡이 각각 19분·29분을 대기하다 잡
# 타임아웃으로 죽었다. 한 시도에 상한을 두면 멈춘 미러를 빠르게 포기하고
# 다시 시도할 수 있다.
#
# 사용법: retry.sh <시도당_제한초> <명령...>
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "사용법: $0 <시도당_제한초> <명령...>" >&2
  exit 2
fi

readonly timeout_seconds="$1"
shift
readonly max_attempts=3
readonly backoff_seconds=15

for attempt in $(seq 1 "$max_attempts"); do
  # TERM 후에도 안 죽으면 10초 뒤 KILL — 멈춘 프로세스가 락을 붙들지 않게 한다.
  # 종료코드는 반드시 명령 직후에 받는다. if 블록 뒤의 $? 는 조건이 아니라
  # if 문 자체의 상태(조건 실패 + else 없음 → 0)여서 실패를 삼킨다.
  timeout --kill-after=10s "$timeout_seconds" "$@"
  status=$?
  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "::error::${max_attempts}회 모두 실패했습니다 (종료코드 ${status}): $*"
    exit "$status"
  fi

  echo "::warning::실패(종료코드 ${status}) — ${backoff_seconds}초 후 재시도 ${attempt}/${max_attempts}: $*"
  sleep "$backoff_seconds"
done
