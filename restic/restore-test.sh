#!/bin/sh
# restic の復元テスト: 「復元できること」と「スナップショットが元データを網羅していること」を確認する
#
# 使い方: docker exec naspi_restic sh /config/restore-test.sh [オプション]
#   --samples N     ランダムに選んだ N 個のファイルを復元して元データと照合する（既定 10）
#   --full          スナップショット全体を復元し、diff -r で元データと照合する（小さい対象向け）
#   --snapshot ID   対象のスナップショット（既定: 元データの最新）
#   --source DIR    元データ（既定: 本番 /data、開発 /config。backup.sh と同じ）
#
# 環境変数:
#   READ_SUBSET           データ本体を読んで検査する割合（既定 10%）
#   COVERAGE_MIN_PERCENT  スナップショットが元データの項目数の何%以上を含むべきか（既定 99）
#   SAMPLE_MAX_BYTES      照合用に抽出するファイルの最大サイズ（既定 20MiB）
#   RESTIC_REPOSITORY     対象のリポジトリ（既定 /backup/repo）
#
# 終了コード: 0=すべて成功 / 1=失敗あり / 2=使い方の誤り
set -u

MODE="${NODE_ENV:-production}"
if [ "$MODE" = "development" ]; then
  SOURCE_DIR="/config"
else
  SOURCE_DIR="/data"
fi
export RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/backup/repo}"
READ_SUBSET="${READ_SUBSET:-10%}"
COVERAGE_MIN_PERCENT="${COVERAGE_MIN_PERCENT:-99}"
SAMPLE_MAX_BYTES="${SAMPLE_MAX_BYTES:-20971520}"
HISTORY_DIR="${HISTORY_DIR:-/history}"

SAMPLES=10
FULL=0
SNAPSHOT=""
TAB=$(printf '\t')

while [ $# -gt 0 ]; do
  case "$1" in
    --samples) SAMPLES="${2:?--samples には件数を指定してください}"; shift 2 ;;
    --full) FULL=1; shift ;;
    --snapshot) SNAPSHOT="${2:?--snapshot にはIDを指定してください}"; shift 2 ;;
    --source) SOURCE_DIR="${2:?--source にはディレクトリを指定してください}"; shift 2 ;;
    *) echo "[restore-test] 不明なオプション: $1"; exit 2 ;;
  esac
done

case "$SAMPLES" in
  ''|*[!0-9]*) echo "[restore-test] --samples には数字を指定してください: $SAMPLES"; exit 2 ;;
esac

START=$(date +%s)
FAILED=0
RESTORE_DIR=$(mktemp -d)
WORK_FILE=$(mktemp)
trap 'rm -rf "$RESTORE_DIR" "$WORK_FILE" "$WORK_FILE.include"' EXIT

ok()   { echo "  [OK] $*"; }
ng()   { echo "  [NG] $*"; FAILED=$((FAILED + 1)); }
note() { echo "  [--] $*"; }

# 結果を履歴に追記する（Bot の履歴と同じ形式）。書けなくてもテストの結果には影響させない
finish() {
  if [ "$FAILED" -eq 0 ]; then
    echo "[restore-test] 結果: 成功"
    rc=0
  else
    echo "[restore-test] 結果: 失敗 ($FAILED 件)"
    rc=1
  fi
  printf '%s\t%s\t%s\t%s\n' "$START" manual "$rc" "$(( $(date +%s) - START ))" \
    >> "$HISTORY_DIR/restore-test.tsv" 2>/dev/null
  exit "$rc"
}

if [ "$FULL" -eq 1 ]; then
  TEST_MODE="全体を復元"
else
  TEST_MODE="ランダムな${SAMPLES}件を復元"
fi
echo "[restore-test] リポジトリ: $RESTIC_REPOSITORY / 元データ: $SOURCE_DIR / $TEST_MODE"

if [ -z "${RESTIC_PASSWORD:-}" ]; then
  ng "RESTIC_PASSWORD が未設定です"
  finish
fi
if [ ! -f "$RESTIC_REPOSITORY/config" ]; then
  ng "$RESTIC_REPOSITORY にリポジトリがありません"
  finish
fi

# 1. リポジトリの整合性
echo "[1/4] リポジトリの整合性チェック（構造 + データの $READ_SUBSET）"
if out=$(restic check --read-data-subset="$READ_SUBSET" 2>&1); then
  ok "エラーなし"
else
  ng "restic check に失敗しました"
  echo "$out" | tail -8 | sed 's/^/        /'
  case "$out" in
    *"already locked"*)
      echo "        バックアップ実行中でなければ、restic unlock で古いロックだけを削除できます（実行中のロックは削除されません）" ;;
  esac
fi

# 2. 対象のスナップショット
echo "[2/4] 対象のスナップショット"
if [ -n "$SNAPSHOT" ]; then
  snap_json=$(restic snapshots "$SNAPSHOT" --json 2>/dev/null)
else
  snap_json=$(restic snapshots --path "$SOURCE_DIR" --json 2>/dev/null)
fi
ID=$(echo "$snap_json" | grep -o '"short_id":"[0-9a-f]*"' | tail -1 | cut -d'"' -f4)
if [ -z "$ID" ]; then
  ng "対象のスナップショットがありません（元データ: $SOURCE_DIR）"
  finish
fi
SNAP_TIME=$(echo "$snap_json" | grep -o '"time":"[^"]*"' | tail -1 | cut -d'"' -f4 | cut -c1-19 | tr T ' ')
ok "$ID ($SNAP_TIME)"

# 3. 網羅性: バックアップが途中で中断されると、読めた分だけのスナップショットが保存されることがある
echo "[3/4] 元データの網羅性（ファイルとディレクトリの数）"
snap_count=$(restic stats "$ID" --mode restore-size --json 2>/dev/null | grep -o '"total_file_count":[0-9]*' | cut -d: -f2)
src_count=$(find "$SOURCE_DIR" 2>/dev/null | wc -l)
if [ -z "$snap_count" ]; then
  ng "スナップショットの項目数を取得できません"
elif [ "$src_count" -eq 0 ]; then
  note "元データ $SOURCE_DIR を読めないため省略します（スナップショット: ${snap_count}件）"
elif [ $((snap_count * 100)) -ge $((src_count * COVERAGE_MIN_PERCENT)) ]; then
  ok "スナップショット ${snap_count}件 / 元データ ${src_count}件"
else
  ng "スナップショットは ${snap_count}件で、元データ ${src_count}件の $((snap_count * 100 / src_count))% しかありません"
  echo "        バックアップが途中で中断された可能性があります。元データが更新されただけなら /backup を実行して再テストしてください"
fi

# 4. 復元と照合
echo "[4/4] 復元と照合"
if [ "$FULL" -eq 1 ]; then
  if restic restore "$ID" --target "$RESTORE_DIR" --verify >/dev/null 2>&1; then
    ok "全体を復元しました"
    if [ "$src_count" -eq 0 ]; then
      note "元データを読めないため diff を省略します"
    elif diff -r "$SOURCE_DIR" "$RESTORE_DIR$SOURCE_DIR" >/dev/null 2>&1; then
      ok "元データと完全に一致しました（diff -r）"
    else
      ng "元データと差分があります（元データがスナップショット後に更新された可能性もあります）"
      diff -rq "$SOURCE_DIR" "$RESTORE_DIR$SOURCE_DIR" 2>&1 | head -5 | sed 's/^/        /'
    fi
  else
    ng "復元に失敗しました"
  fi
else
  # 0バイト超・上限以下のファイルからランダムに選ぶ（パスに \ を含むものは JSON のエスケープ解除が必要なため対象外）
  restic ls "$ID" --json 2>/dev/null |
    grep '"type":"file"' |
    sed -n "s/.*\"path\":\"\([^\"]*\)\".*\"size\":\([0-9]*\).*/\2${TAB}\1/p" |
    grep -v '\\' |
    awk -F"$TAB" -v max="$SAMPLE_MAX_BYTES" '$1 > 0 && $1 <= max' |
    awk 'BEGIN { srand() } { print rand() "\t" $0 }' | sort | head -n "$SAMPLES" | cut -f2- > "$WORK_FILE"

  if [ ! -s "$WORK_FILE" ]; then
    note "照合できるファイル（0バイト超、$((SAMPLE_MAX_BYTES / 1048576))MiB以下）がスナップショットにありません"
  else
    # restic の --include はパターンのため、特殊文字をエスケープして1行1パスで渡す
    cut -f2- "$WORK_FILE" | sed 's/\*/\\*/g; s/?/\\?/g; s/\[/\\[/g' > "$WORK_FILE.include"
    if restic restore "$ID" --target "$RESTORE_DIR" --include-file "$WORK_FILE.include" --verify >/dev/null 2>&1; then
      restored=0
      matched=0
      skipped=0
      bad=0
      while IFS="$TAB" read -r size path; do
        if [ ! -f "$RESTORE_DIR$path" ]; then
          ng "復元されていません: $path"
          bad=$((bad + 1))
          continue
        fi
        restored=$((restored + 1))
        # 元データが無い、またはスナップショット後に更新されたファイルは照合できない
        if [ ! -f "$path" ] || [ "$(wc -c < "$path")" -ne "$size" ]; then
          skipped=$((skipped + 1))
        elif cmp -s "$RESTORE_DIR$path" "$path"; then
          matched=$((matched + 1))
        else
          ng "内容が一致しません: $path"
          bad=$((bad + 1))
        fi
      done < "$WORK_FILE"
      summary="復元 ${restored}件 / 元データと一致 ${matched}件 / 照合できず ${skipped}件（元データなし、または更新済み）"
      if [ "$bad" -eq 0 ]; then ok "$summary"; else note "$summary"; fi
      if [ "$matched" -eq 0 ] && [ "$restored" -gt 0 ]; then
        note "元データと照合できたファイルがありません（復元自体は restic --verify で検証済み）"
      fi
    else
      ng "復元に失敗しました"
    fi
  fi
fi

finish
