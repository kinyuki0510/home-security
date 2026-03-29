import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase クライアントをモック
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
    body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [] },
    ...overrides,
  };
  return { req, res };
}

describe("anthropic handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // デフォルト: 認証成功
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
  });

  it("GETは405を返す", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("Authorizationヘッダーなしは401を返す", async () => {
    const { req, res } = makeReqRes({ headers: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("無効なJWTは401を返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("bodyがない場合は400を返す", async () => {
    const { req, res } = makeReqRes({ body: null });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("bodyが文字列の場合は400を返す", async () => {
    const { req, res } = makeReqRes({ body: "invalid" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("bodyが5MBを超える場合は413を返す", async () => {
    const { req, res } = makeReqRes({ body: { data: "x".repeat(5 * 1024 * 1024 + 1) } });
    await handler(req, res);
    expect(res.statusCode).toBe(413);
  });

  it("正常なリクエストはAnthropicに転送する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ content: [{ type: "text", text: '{"level":"SAFE","message":"安全"}' }] }),
    }));
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });
});
