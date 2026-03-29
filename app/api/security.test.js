/**
 * セキュリティテスト仕様
 *
 * 各テストは以下のいずれかのステータスを持つ:
 *   PASS   - 保護が実装済み
 *   FAIL   - 脆弱性が存在する（修正が必要）
 *   MANUAL - 自動化不可・手動確認が必要
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

const { default: handler } = await import("./anthropic.js");

function makeReqRes(overrides = {}) {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body)  { this.body = body;       return this; },
  };
  const req = {
    method: "POST",
    headers: { authorization: "Bearer valid-token" },
    body: { model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [] },
    ...overrides,
  };
  return { req, res };
}

// ─────────────────────────────────────────────────────────────
// [PASS] 既存の保護
// ─────────────────────────────────────────────────────────────
describe("[PASS] 既存の保護", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
  });

  it("GET リクエストは 405 を返す", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("Authorization ヘッダーなしは 401 を返す", async () => {
    // curl から Origin を偽装しても JWT がなければ弾かれる
    const { req, res } = makeReqRes({ headers: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("無効な JWT は 401 を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("body なしは 400 を返す", async () => {
    const { req, res } = makeReqRes({ body: null });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("5MB 超のボディは 413 を返す", async () => {
    const { req, res } = makeReqRes({ body: { data: "x".repeat(5 * 1024 * 1024 + 1) } });
    await handler(req, res);
    expect(res.statusCode).toBe(413);
  });
});

// ─────────────────────────────────────────────────────────────
// [FAIL] 未実装の保護（修正が必要）
// ─────────────────────────────────────────────────────────────
describe("[FAIL] 未実装の保護", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ content: [] }),
    }));
  });

  it("高コストモデルを指定してもhaikusに上書きされる", async () => {
    const { req, res } = makeReqRes({
      body: { model: "claude-opus-4-6", max_tokens: 10000, messages: [] },
    });
    await handler(req, res);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        body: expect.stringContaining('"model":"claude-haiku-4-5-20251001"'),
      })
    );
  });

  it("max_tokensが500を超えても500に切り詰められる", async () => {
    const { req, res } = makeReqRes({
      body: { model: "claude-haiku-4-5-20251001", max_tokens: 100000, messages: [] },
    });
    await handler(req, res);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":500'),
      })
    );
  });

});

// ─────────────────────────────────────────────────────────────
// [MANUAL] 手動確認が必要な項目
// 以下は自動テストでは検証できないため docs/pentest-manual.md を参照
// ─────────────────────────────────────────────────────────────
describe.skip("[MANUAL] 手動確認項目（自動化不可）", () => {
  it("VITE_ANTHROPIC_API_KEY_DEV が本番バンドルに含まれていないこと");
  it("Supabase の Disable sign ups が ON になっていること");
  it("curl から有効な JWT なしで API を叩けないこと（JWT 検証で対応済み）");
  it("ブラウザ DevTools で anon key 以外の秘匿情報が露出していないこと");
  it("Magic Link のリダイレクト先が許可リスト外のURLを受け付けないこと");
});
