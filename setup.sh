#!/bin/bash
set -e

# ── 1. nvm インストール（未インストールの場合のみ） ──────────────────────────
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# ── 2. nvm をこのスクリプト内で有効化 ────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

# ── 3. .nvmrc が無ければ LTS バージョンを固定する ────────────────────────────
if [ ! -f ".nvmrc" ]; then
  node --version 2>/dev/null | grep -q 'v' || nvm install --lts
  nvm version default | tr -d 'v' > .nvmrc
  echo ".nvmrc を作成しました: $(cat .nvmrc)"
fi

# ── 4. .nvmrc に従って Node を使用 ───────────────────────────────────────────
nvm install   # .nvmrc のバージョンをインストール（未インストール時のみ）
nvm use       # .nvmrc のバージョンに切り替え

# ── 5. 確認 ──────────────────────────────────────────────────────────────────
echo ""
echo "Node.js: $(node -v)"
echo "npm:     $(npm -v)"
echo "場所:    $(which node)"
