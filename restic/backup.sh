#!/bin/sh
# restic による SSD → HDD の世代管理バックアップ（日次7世代・週次2世代）
set -u

SOURCE_DIR="/data"
export RESTIC_REPOSITORY="/backup/repo"
INTERVAL="${BACKUP_INTERVAL:-86400}"

while true; do
  if [ -z "${RESTIC_PASSWORD:-}" ]; then
    echo "[backup] RESTIC_PASSWORD が未設定です。.env に設定してください"
  elif ! restic cat config >/dev/null 2>&1; then
    # HDD未マウント時に誤って別の場所へ作成しないよう、初期化は手動で行う
    echo "[backup] $RESTIC_REPOSITORY にリポジトリがありません。restic init で初期化してください"
  else
    restic backup "$SOURCE_DIR" &&
      restic forget --prune --keep-daily 7 --keep-weekly 2
  fi
  sleep "$INTERVAL"
done
