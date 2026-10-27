#!/bin/sh
# rclone bisync による SSD ↔ Proton Drive 双方向同期
set -u

LOCAL_DIR="/data"
REMOTE="${RCLONE_REMOTE:-protondrive:}"
INTERVAL="${SYNC_INTERVAL:-1800}"
WORKDIR="/config/rclone/bisync"

run_bisync() {
  rclone bisync "$LOCAL_DIR" "$REMOTE" \
    --workdir "$WORKDIR" \
    --compare size,modtime \
    --create-empty-src-dirs \
    --resilient \
    --recover \
    --max-lock 2m \
    --conflict-resolve newer \
    --protondrive-replace-existing-draft \
    --log-level INFO \
    "$@"
}

mkdir -p "$WORKDIR"

while true; do
  if [ ! -f "$RCLONE_CONFIG" ]; then
    echo "[sync] $RCLONE_CONFIG が見つかりません。rclone config で Proton Drive を設定してください"
  elif ls "$WORKDIR"/*.lst-err >/dev/null 2>&1; then
    # 致命的エラー後は自動復旧せず、手動での --resync を待つ
    echo "[sync] 前回の bisync が致命的エラーで停止しています。内容を確認後、手動で --resync を実行してください"
  elif ls "$WORKDIR"/*.lst >/dev/null 2>&1; then
    run_bisync
  else
    # 初回のみ両側の和集合で基準状態を作る（削除は行わない）
    echo "[sync] 初回実行のため --resync で初期化します"
    run_bisync --resync --resync-mode newer
  fi
  sleep "$INTERVAL"
done
