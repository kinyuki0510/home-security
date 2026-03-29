#!/bin/bash
# セキュリティ手動確認項目の自動チェックスクリプト
# 使い方: bash scripts/security-check.sh

set -euo pipefail

PASS="\033[32mPASS\033[0m"
FAIL="\033[31mFAIL\033[0m"
SKIP="\033[33mSKIP\033[0m"

echo "=== Security Check ==="
echo ""

# ── Vercel から環境変数を取得 ──────────────────────────────────
echo "Vercel から環境変数を取得中..."
vercel env pull .env.security --yes 2>/dev/null
trap 'rm -f .env.security; unset SUPABASE_URL SUPABASE_ANON_KEY VITE_SUPABASE_URL VITE_SUPABASE_KEY' EXIT
source .env.security
SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_KEY:-}"
echo ""

# ── 8. 本番バンドルへの API キー露出 ──────────────────────────
echo "[8] 本番バンドルへの API キー露出"
npm run build --silent 2>/dev/null
if grep -r "sk-ant\|ANTHROPIC_API_KEY" dist/assets/ 2>/dev/null | grep -qv "VITE_ANTHROPIC_API_KEY_DEV"; then
  echo -e "  → $FAIL: Anthropic API キーがバンドルに含まれています"
else
  echo -e "  → $PASS: Anthropic API キーはバンドルに含まれていません"
fi
rm -rf dist

echo ""

# ── 9. Disable sign ups ────────────────────────────────────────
echo "[9] Disable sign ups"
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo -e "  → $SKIP: SUPABASE_URL / SUPABASE_ANON_KEY が未設定"
else
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/otp" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"email":"pentest-check@example.com"}')

  if echo "$RESPONSE" | grep -q "signup_disabled"; then
    echo -e "  → $PASS: 新規サインアップは無効化されています"
  else
    echo -e "  → $FAIL: 新規サインアップが有効になっています"
    echo "     Supabase ダッシュボード → Authentication → Settings → Disable sign ups"
  fi
fi

echo ""

# ── 10. Magic Link リダイレクト先の検証 ───────────────────────
echo "[10] Magic Link リダイレクト先の検証（不正 URL の拒否）"
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo -e "  → $SKIP: SUPABASE_URL / SUPABASE_ANON_KEY が未設定"
else
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/otp" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"email":"pentest-check@example.com","options":{"emailRedirectTo":"https://evil.com"}}')

  # Supabase は不正なリダイレクト先を受け付けても Site URL にフォールバックする
  # エラーなく受け付けた場合は手動でメールのリンク先を確認する必要がある
  if echo "$RESPONSE" | grep -q "error"; then
    echo -e "  → $PASS: 不正なリダイレクト先はリクエスト時点で拒否されました"
  else
    echo -e "  → 要確認: リクエストは通過しました"
    echo "     Supabase は Site URL にフォールバックするため、実際のメールリンクを確認してください"
    echo "     Supabase ダッシュボード → Authentication → URL Configuration → Redirect URLs"
  fi
fi

echo ""
echo "=== 完了 ==="
