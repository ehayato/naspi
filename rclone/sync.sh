#!/bin/sh
# 本番: rclone bisync による SSD ↔ Proton Drive 双方向同期
# 開発: rclone mount によるクラウドの直接参照（ローカルコピーなし）
set -u

MODE="${NODE_ENV:-production}"
LOCAL_DIR="/data"
REMOTE="${RCLONE_REMOTE:-protondrive:}"
INTERVAL="${SYNC_INTERVAL:-1800}"
WORKDIR="/config/rclone/bisync"

# 実行結果を履歴に追記する（Botの /log・/status が読む）
# 形式: 開始時刻(epoch)<TAB>auto|manual<TAB>終了コード<TAB>所要秒
# 直近の出力は sync.last.log に残す。履歴を書けなくても本処理の成否には影響させない
HISTORY_DIR="${HISTORY_DIR:-/history}"
HISTORY_MAX_LINES=1000

# 同期とバックアップが同時に動かないよう、実行中は /history に印のファイルを置く
# （バックアップ中は同期を見送り、同期中はバックアップが終わるのを待つ）
SYNC_LOCK="$HISTORY_DIR/sync.lock"
BACKUP_LOCK="$HISTORY_DIR/backup.lock"
SYNC_LOCK_MAX_AGE=7200      # これより古い印は、異常終了の名残とみなす
BACKUP_LOCK_MAX_AGE=21600
BUSY_EXIT=5                 # バックアップ中のため、同期を見送った

# 印のファイルがあり、かつ古すぎない（実行中とみなせる）か
lock_active() {
  [ -f "$1" ] || return 1
  [ $(( $(date +%s) - $(stat -c %Y "$1" 2>/dev/null || echo 0) )) -lt "$2" ]
}

run_recorded() {
  trigger="$1"
  shift
  start=$(date +%s)
  rc_file=$(mktemp)

  { "$@"; echo $? > "$rc_file"; } 2>&1 | tee "$HISTORY_DIR/sync.last.log"
  rc=$(cat "$rc_file")
  rm -f "$rc_file"

  printf '%s\t%s\t%s\t%s\n' "$start" "$trigger" "$rc" "$(( $(date +%s) - start ))" \
    >> "$HISTORY_DIR/sync.tsv"
  tail -n "$HISTORY_MAX_LINES" "$HISTORY_DIR/sync.tsv" > "$HISTORY_DIR/sync.tsv.tmp" &&
    mv "$HISTORY_DIR/sync.tsv.tmp" "$HISTORY_DIR/sync.tsv"
  return "$rc"
}

# 設定ファイルにリモートが定義済みか（[name] だけで type 未設定の場合も未定義扱い）
remote_ready() {
  rclone listremotes 2>/dev/null | grep -qx "${REMOTE%%:*}:"
}

# --- Proton Drive の認証エラー ---
# 認証が切れた状態で再ログインを繰り返すと、レート制限（Too many recent logins）を招く。
# 認証エラーを検知したら状態ファイルに記録し、rclone.conf が更新される（再認証される）まで再試行しない。
# 状態ファイル(sync.state)の形式: auth_error<TAB>検知時刻(epoch)<TAB>そのときの rclone.conf の更新時刻
# Bot はこのファイルを読んで、Discord に再認証が必要なことを通知する
STATE_FILE="$HISTORY_DIR/sync.state"
AUTH_ERROR_EXIT=4

conf_mtime() {
  stat -c %Y "$RCLONE_CONFIG" 2>/dev/null || echo 0
}

# 出力ファイルに Proton の認証エラーがあるか
has_auth_error() {
  grep -qE 'proton\.me/auth/v4' "$1" 2>/dev/null
}

mark_auth_error() {
  printf 'auth_error\t%s\t%s\n' "$(date +%s)" "$(conf_mtime)" > "$STATE_FILE" 2>/dev/null
}

clear_auth_error() {
  rm -f "$STATE_FILE" 2>/dev/null
}

# 認証エラーを記録済みで、その後 rclone.conf が更新されていない（再認証されていない）か
auth_blocked() {
  [ -f "$STATE_FILE" ] || return 1
  [ "$(cut -f3 "$STATE_FILE" 2>/dev/null)" = "$(conf_mtime)" ]
}

AUTH_MESSAGE="[sync] Proton Drive の認証が切れています。rclone config で再認証してください（rclone.conf が更新されるまで再試行しません）"

run_mount() {
  # 前回の異常終了でマウントが残っている場合に備えて解除しておく
  fusermount3 -uz "$LOCAL_DIR" 2>/dev/null

  # 認証エラーの後は、再認証されるまで待つ（再起動ループによるログインの繰り返しを防ぐ）
  if auth_blocked; then
    echo "$AUTH_MESSAGE"
    while auth_blocked; do sleep 30; done
    echo "[mount] rclone.conf が更新されたため、マウントを再開します"
  fi

  # 出力を画面と履歴の両方へ流す。rclone を直接の子プロセスにして、停止シグナルを渡す
  log_fifo="/tmp/mount-log.$$"
  mkfifo "$log_fifo"
  tee "$HISTORY_DIR/sync.last.log" < "$log_fifo" &
  rclone mount "$REMOTE" "$LOCAL_DIR" \
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
    --log-level INFO > "$log_fifo" 2>&1 &
  mount_pid=$!
  trap 'kill -TERM "$mount_pid" 2>/dev/null; wait "$mount_pid"' TERM INT

  # 20秒たっても動いていれば、認証できたとみなす
  ( sleep 20; kill -0 "$mount_pid" 2>/dev/null && clear_auth_error ) &

  wait "$mount_pid"
  rc=$?
  trap - TERM INT
  rm -f "$log_fifo"

  if has_auth_error "$HISTORY_DIR/sync.last.log"; then
    mark_auth_error
    echo "$AUTH_MESSAGE"
  fi
  exit "$rc"
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
  if auth_blocked; then
    echo "$AUTH_MESSAGE"
    return "$AUTH_ERROR_EXIT"
  elif ! remote_ready; then
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

# 同期を1回実行し、履歴と認証エラーの状態を更新する
sync_cycle() {
  if lock_active "$BACKUP_LOCK" "$BACKUP_LOCK_MAX_AGE"; then
    echo "[sync] バックアップ実行中のため、同期を見送ります"
    return "$BUSY_EXIT"
  fi

  touch "$SYNC_LOCK" 2>/dev/null
  run_recorded "$1" sync_once
  rc=$?
  rm -f "$SYNC_LOCK" 2>/dev/null
  if [ "$rc" -eq 0 ]; then
    clear_auth_error
  elif [ "$rc" -ne "$AUTH_ERROR_EXIT" ] && has_auth_error "$HISTORY_DIR/sync.last.log"; then
    mark_auth_error
  fi
  return "$rc"
}

# Discord Bot からの手動実行用: 1回だけ同期して終了する（終了コードで成否を返す）
if [ "${1:-}" = "once" ]; then
  sync_cycle manual
  exit $?
fi

# コンテナの起動時点では、同期もバックアップも動いていない。前回の異常終了で残った印は消す
rm -f "$SYNC_LOCK" 2>/dev/null

# 起動からの経過ではなく、時計に合わせて実行する（INTERVAL=1800 なら毎時 00 分と 30 分）。
# 実行時刻がずれないよう、実行にかかった時間を差し引いて次の時刻まで待つ
echo "[sync] ${INTERVAL}秒ごとに、時計に合わせて実行します"
while true; do
  sleep $(( INTERVAL - $(date +%s) % INTERVAL ))
  sync_cycle auto
done
