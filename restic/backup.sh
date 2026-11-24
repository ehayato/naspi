#!/bin/sh
# restic による SSD → HDD の世代管理バックアップ（日次7世代・週次2世代）
set -u

MODE="${NODE_ENV:-production}"
if [ "$MODE" = "development" ]; then
  # 開発モードでは /data に rclone の FUSE マウント(クラウド全体)が見えることがあり、
  # 全ファイルをダウンロードしてしまうため、動作確認用の小さなローカルディレクトリを対象にする
  SOURCE_DIR="/config"
else
  SOURCE_DIR="/data"
fi
export RESTIC_REPOSITORY="/backup/repo"
# 毎日この時刻(HH:MM)に実行する。同期は毎時 00 分と 30 分に動くため、その間の時刻にする
BACKUP_TIME="${BACKUP_TIME:-03:15}"

# 実行結果を履歴に追記する（Botの /log・/status が読む）
# 形式: 開始時刻(epoch)<TAB>auto|manual<TAB>終了コード<TAB>所要秒
# 直近の出力は backup.last.log に残す。履歴を書けなくても本処理の成否には影響させない
HISTORY_DIR="${HISTORY_DIR:-/history}"
HISTORY_MAX_LINES=1000

# 同期とバックアップが同時に動かないよう、実行中は /history に印のファイルを置く
# （同期中は終わるのを待ち、バックアップ中は同期が見送られる）
SYNC_LOCK="$HISTORY_DIR/sync.lock"
BACKUP_LOCK="$HISTORY_DIR/backup.lock"
SYNC_LOCK_MAX_AGE=7200      # これより古い印は、異常終了の名残とみなす
SYNC_WAIT_MAX=1800          # 同期の終了を待つ上限(秒)

lock_active() {
  [ -f "$1" ] || return 1
  [ $(( $(date +%s) - $(stat -c %Y "$1" 2>/dev/null || echo 0) )) -lt "$2" ]
}

# 次の BACKUP_TIME までの秒数
seconds_until_backup() {
  h=${BACKUP_TIME%%:*}; m=${BACKUP_TIME##*:}
  h=${h#0}; m=${m#0}
  now_h=$(date +%H); now_m=$(date +%M); now_s=$(date +%S)
  now_h=${now_h#0}; now_m=${now_m#0}; now_s=${now_s#0}
  delta=$(( ${h:-0} * 3600 + ${m:-0} * 60 - (${now_h:-0} * 3600 + ${now_m:-0} * 60 + ${now_s:-0}) ))
  [ "$delta" -le 0 ] && delta=$((delta + 86400))
  echo "$delta"
}

run_recorded() {
  trigger="$1"
  shift
  start=$(date +%s)
  rc_file=$(mktemp)

  { "$@"; echo $? > "$rc_file"; } 2>&1 | tee "$HISTORY_DIR/backup.last.log"
  rc=$(cat "$rc_file")
  rm -f "$rc_file"

  printf '%s\t%s\t%s\t%s\n' "$start" "$trigger" "$rc" "$(( $(date +%s) - start ))" \
    >> "$HISTORY_DIR/backup.tsv"
  tail -n "$HISTORY_MAX_LINES" "$HISTORY_DIR/backup.tsv" > "$HISTORY_DIR/backup.tsv.tmp" &&
    mv "$HISTORY_DIR/backup.tsv.tmp" "$HISTORY_DIR/backup.tsv"
  return "$rc"
}

# 同期の終了を待ち、実行中は印を置いて1回分のバックアップを行う
backup_once() {
  waited=0
  while lock_active "$SYNC_LOCK" "$SYNC_LOCK_MAX_AGE" && [ "$waited" -lt "$SYNC_WAIT_MAX" ]; do
    [ "$waited" -eq 0 ] && echo "[backup] 同期の実行中のため、終了を待ちます"
    sleep 15
    waited=$((waited + 15))
  done

  touch "$BACKUP_LOCK" 2>/dev/null
  backup_body
  rc=$?
  rm -f "$BACKUP_LOCK" 2>/dev/null
  return "$rc"
}

# 1回分のバックアップ。実行できない状態のときは理由を表示して1を返す
backup_body() {
  if [ -z "${RESTIC_PASSWORD:-}" ]; then
    echo "[backup] RESTIC_PASSWORD が未設定です。.env に設定してください"
    return 1
  elif [ ! -f "$RESTIC_REPOSITORY/config" ]; then
    # 存在確認はファイルで行う（restic を呼ぶとロック競合やパスワード違いも「なし」に見えてしまう）
    # HDD未マウント時に誤って別の場所へ作成しないよう、初期化は手動で行う
    echo "[backup] $RESTIC_REPOSITORY にリポジトリがありません。restic init で初期化してください"
    return 1
  fi

  if [ "$MODE" = "development" ]; then
    echo "[backup] 開発モードのためクラウドは対象外とし、$SOURCE_DIR をバックアップします"
  fi

  restic backup "$SOURCE_DIR"
  rc=$?
  if [ "$rc" -eq 3 ]; then
    # 一部が読めなくても restic はスナップショットを保存する（終了コード3）。
    # 不完全なものが世代として数えられないよう partial タグを付け、世代整理は行わない
    id=$(restic snapshots --path "$SOURCE_DIR" --latest 1 --json 2>/dev/null |
      grep -o '"short_id":"[0-9a-f]*"' | tail -1 | cut -d'"' -f4)
    if [ -n "$id" ] && restic tag --add partial "$id" >/dev/null 2>&1; then
      echo "[backup] 一部のファイルを読めませんでした。スナップショットに partial タグを付けました"
    fi
    return 3
  elif [ "$rc" -ne 0 ]; then
    return "$rc"
  fi

  # 完全なスナップショットが取れたので、過去の不完全なもの(partial)を削除してから世代を整理する
  # （forget は --tag だけでは何も削除しないため、ID を取得して指定する）
  partial_ids=$(restic snapshots --tag partial --json 2>/dev/null | grep -o '"short_id":"[0-9a-f]*"' | cut -d'"' -f4)
  if [ -n "$partial_ids" ]; then
    # shellcheck disable=SC2086
    restic forget $partial_ids >/dev/null 2>&1 && echo "[backup] 不完全なスナップショットを削除しました: $partial_ids"
  fi
  restic forget --prune --keep-daily 7 --keep-weekly 2
}

# Discord Bot からの手動実行用: 1回だけバックアップして終了する（終了コードで成否を返す）
if [ "${1:-}" = "once" ]; then
  run_recorded manual backup_once
  exit $?
fi

# コンテナの起動時点ではバックアップは動いていない。前回の異常終了で残った印は消す
rm -f "$BACKUP_LOCK" 2>/dev/null

case "$BACKUP_TIME" in
  [0-2][0-9]:[0-5][0-9]) ;;
  *) echo "[backup] BACKUP_TIME は HH:MM の形式で指定してください: $BACKUP_TIME"; exit 1 ;;
esac

echo "[backup] 毎日 $BACKUP_TIME に実行します"
while true; do
  sleep "$(seconds_until_backup)"
  run_recorded auto backup_once
done
