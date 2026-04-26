#!/bin/bash
set -e

# ====== 基本パッケージ更新 ======
echo "[1/6] Updating apt..."
sudo apt update && sudo apt upgrade -y

# ====== 必要パッケージインストール ======
echo "[2/6] Installing core packages..."
sudo apt install -y python3 python3-pip git curl docker.io docker-compose nodejs npm vim

# ====== dockerグループ追加 ======
echo "[3/6] Adding user to docker group..."
sudo usermod -aG docker $USER

# ====== サービス有効化・起動 ======
echo "[4/6] Enabling and starting docker..."
sudo systemctl enable docker || true
sudo systemctl start docker || true

# ====== プロジェクトディレクトリ作成 ======
echo "[5/6] Creating project directories..."
mkdir -p rclone restic samba

# ====== .env.exampleコピー（初回のみ） ======
echo "[6/6] Copying .env.example to .env (if not exists)..."
[ -f .env ] || cp .env.example .env

# ====== 完了メッセージ ======
echo "\nSetup complete! Please restart your shell or run: exec $SHELL"
echo "Then you can run: docker-compose up -d"
