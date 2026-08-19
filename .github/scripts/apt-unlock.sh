#!/usr/bin/env bash
# 중단된 apt 가 남긴 락과 프로세스를 치운다.
#
# timeout 으로 apt 를 끊으면, sudo 아래에서 도는 apt-get 이 살아남아
# /var/lib/apt/lists/lock 을 계속 쥐고 있는 경우가 있다. 그러면 이어지는 재시도가
# 전부 "Could not get lock ... held by process N" 로 즉사한다. 2026-08-19 CI 에서
# 재시도 2·3 회가 이렇게 통째로 무의미해졌다.
#
# 실패해도 무시한다 — 치울 게 없을 수도 있고, 여기서 막히면 안 된다.
set -u

sudo pkill --signal KILL --exact apt-get 2>/dev/null || true
sudo pkill --signal KILL --exact apt 2>/dev/null || true
sudo pkill --signal KILL --exact dpkg 2>/dev/null || true

sudo rm --force \
  /var/lib/apt/lists/lock \
  /var/cache/apt/archives/lock \
  /var/lib/dpkg/lock \
  /var/lib/dpkg/lock-frontend 2>/dev/null || true

# 중간에 끊긴 설치가 있으면 dpkg 상태를 되돌려 놓는다.
sudo dpkg --configure -a 2>/dev/null || true

echo "apt 락 정리 완료"
