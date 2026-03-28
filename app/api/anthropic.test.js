import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "./anthropic.js";

const PROD_ORIGIN = "https://home-security.vercel.app";
const LOCAL_ORIGIN = "http://localhost:5173";

function makeReqRes(overrides = {}) {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const req = {
    method: "POST",
    headers: { origin: LOCAL_ORIGIN },
    body: { model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [] },
    ...overrides,
  };
  return { req, res };
}

describe("anthropic handler", () => {
  beforeEach(() => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.restoreAllMocks();
  });

  it("GETは405を返す", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("不正なoriginは403を返す", async () => {
    const { req, res } = makeReqRes({ headers: { origin: "https://evil.com" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
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
    const largeBody = { data: "x".repeat(5 * 1024 * 1024 + 1) };
    const { req, res } = makeReqRes({ body: largeBody });
    await handler(req, res);
    expect(res.statusCode).toBe(413);
  });

  it("本番環境では本番originのみ許可する", async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "home-security.vercel.app";
    vi.resetModules();
    const { default: prodHandler } = await import("./anthropic.js?prod");
    const { req, res } = makeReqRes({ headers: { origin: LOCAL_ORIGIN } });
    await prodHandler(req, res);
    expect(res.statusCode).toBe(403);
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
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
