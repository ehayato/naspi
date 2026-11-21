#!/bin/sh
# 本番: rclone bisync による SSD ↔ Proton Drive 双方向同期
# 開発: rclone mount によるクラウドの直接参照（ローカルコピーなし）
set -u

MODE="${NODE_ENV:-production}"
LOCAL_DIR="/data"
REMOTE="${RCLONE_REMOTE:-protondrive:}"
INTERVAL="${SYNC_INTERVAL:-1800}"
WORKDIR="/config/rclone/bisync"

# 設定ファイルにリモートが定義済みか（[name] だけで type 未設定の場合も未定義扱い）
remote_ready() {
  rclone listremotes 2>/dev/null | grep -qx "${REMOTE%%:*}:"
}

run_mount() {
  # 前回の異常終了でマウントが残っている場合に備えて解除しておく
  fusermount3 -uz "$LOCAL_DIR" 2>/dev/null

  # exec でrcloneにシグナルを渡し、コンテナ停止時にアンマウントさせる
  exec rclone mount "$REMOTE" "$LOCAL_DIR" \
    --allow-other \
    --allow-non-empty \
    --uid 1000 \
    --gid 1000 \
    --umask 002 \
    --vfs-cache-mode writes \
    --vfs-cache-max-size 1G \
    --vfs-cache-max-age 1h \
    --dir-cache-time 1m \
    --protondrive-replace-existing-draft \
    --log-level INFO
}

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

# 1回分の同期。同期できない状態のときは理由を表示して1を返す
sync_once() {
  if ! remote_ready; then
    echo "[sync] $RCLONE_CONFIG にリモート ${REMOTE%%:*} が設定されていません。rclone config で Proton Drive を設定してください"
    return 1
  elif ls "$WORKDIR"/*.lst-err >/dev/null 2>&1; then
    # 致命的エラー後は自動復旧せず、手動での --resync を待つ
    echo "[sync] 前回の bisync が致命的エラーで停止しています。内容を確認後、手動で --resync を実行してください"
    return 1
  elif ls "$WORKDIR"/*.lst >/dev/null 2>&1; then
    run_bisync
  else
    # 初回のみ両側の和集合で基準状態を作る（削除は行わない）
    echo "[sync] 初回実行のため --resync で初期化します"
    run_bisync --resync --resync-mode newer
  fi
}

if [ "$MODE" = "development" ]; then
  if [ "${1:-}" = "once" ]; then
    echo "[sync] 開発モードではクラウドを直接マウントしているため、同期は行いません"
    exit 1
  fi
  until remote_ready; do
    echo "[mount] $RCLONE_CONFIG にリモート ${REMOTE%%:*} が設定されていません。rclone config で Proton Drive を設定してください"
    sleep 60
  done
  echo "[mount] 開発モードのため $REMOTE を $LOCAL_DIR にマウントします（bisyncは停止）"
  run_mount
fi

mkdir -p "$WORKDIR"

# Discord Bot からの手動実行用: 1回だけ同期して終了する（終了コードで成否を返す）
if [ "${1:-}" = "once" ]; then
  sync_once
  exit $?
fi

while true; do
  sync_once
  sleep "$INTERVAL"
done
