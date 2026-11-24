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
INTERVAL="${BACKUP_INTERVAL:-86400}"

# 実行結果を履歴に追記する（Botの /log・/status が読む）
# 形式: 開始時刻(epoch)<TAB>auto|manual<TAB>終了コード<TAB>所要秒
# 直近の出力は backup.last.log に残す。履歴を書けなくても本処理の成否には影響させない
HISTORY_DIR="${HISTORY_DIR:-/history}"
HISTORY_MAX_LINES=1000

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

# 1回分のバックアップ。実行できない状態のときは理由を表示して1を返す
backup_once() {
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
      echo "[backup] 一部のファイルを読めませんでした。スナップショット $id に partial タグを付けました"
    fi
    return 3
  elif [ "$rc" -ne 0 ]; then
    return "$rc"
  fi

  # 完全なスナップショットが取れたので、過去の不完全なもの(partial)を削除してから世代を整理する
  restic forget --tag partial >/dev/null 2>&1
  restic forget --prune --keep-daily 7 --keep-weekly 2
}

# Discord Bot からの手動実行用: 1回だけバックアップして終了する（終了コードで成否を返す）
if [ "${1:-}" = "once" ]; then
  run_recorded manual backup_once
  exit $?
fi

while true; do
  run_recorded auto backup_once
  sleep "$INTERVAL"
done
