import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry } from "@soryos/tool";
import type { SessionData } from "@soryos/schema";

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

function makeSession(): SessionData {
  return {
    id: "edit-test-session",
    title: "edit-test-session",
    sandbox_id: "",
    sandbox_state: "running",
    environment: "local",
    providerId: "local",
    model: "gemini-3.8-flash",
    provider: "google",
    created_at: new Date().toISOString(),
    messages: [],
    files: {},
    openFiles: [],
    activeFile: "",
    preview_url: null,
    needs_run: false,
    agent_running: false,
    cwd: "",
  };
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-edit-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed");
  provider = new LocalExecutionProvider(tmp);
  await provider.init(tmp);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("edit_file via ToolExecutor (disque réel)", () => {
  it("édition exacte unique vérifiée sur disque", async () => {
    const session = makeSession();
    session.cwd = tmp;
    fs.writeFileSync(path.join(tmp, "a.txt"), "hello world\n");

    const r = await executor.execute(
      "edit_file",
      { path: "a.txt", targetContent: "world", replacementContent: "SoryOS" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf8")).toBe("hello SoryOS\n");
    expect(r.metadata).toMatchObject({ occurrencesFound: 1, replacementsApplied: 1 });
  });

  it("accepte les alias old_string/new_string", async () => {
    const session = makeSession();
    session.cwd = tmp;
    fs.writeFileSync(path.join(tmp, "alias.txt"), "foo bar\n");

    const r = await executor.execute(
      "edit_file",
      { path: "alias.txt", old_string: "bar", new_string: "baz" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(fs.readFileSync(path.join(tmp, "alias.txt"), "utf8")).toBe("foo baz\n");
  });

  it("échoue sur correspondances multiples sans allOccurrences (honnête)", async () => {
    const session = makeSession();
    session.cwd = tmp;
    fs.writeFileSync(path.join(tmp, "multi.txt"), "dup dup\n");

    const r = await executor.execute(
      "edit_file",
      { path: "multi.txt", targetContent: "dup", replacementContent: "x" },
      provider, session, "build"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/Found 2 matches/);
    expect(fs.readFileSync(path.join(tmp, "multi.txt"), "utf8")).toBe("dup dup\n");
  });

  it("remplace tout avec allOccurrences=true", async () => {
    const session = makeSession();
    session.cwd = tmp;
    fs.writeFileSync(path.join(tmp, "all.txt"), "dup dup\n");

    const r = await executor.execute(
      "edit_file",
      { path: "all.txt", targetContent: "dup", replacementContent: "x", allOccurrences: true },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(fs.readFileSync(path.join(tmp, "all.txt"), "utf8")).toBe("x x\n");
  });

  it("mode plan : édition refusée par permissions", async () => {
    const session = makeSession();
    session.cwd = tmp;
    fs.writeFileSync(path.join(tmp, "plan.txt"), "abc\n");

    const r = await executor.execute(
      "edit_file",
      { path: "plan.txt", targetContent: "abc", replacementContent: "x" },
      provider, session, "plan"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("PERMISSION DENIED");
    expect(fs.readFileSync(path.join(tmp, "plan.txt"), "utf8")).toBe("abc\n");
  });
});

describe("webfetch via ToolExecutor (fetch réel, mocké)", () => {
  const fetchMock = vi.fn();

  beforeAll(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("récupère une page HTML et extrait le texte", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html><head><style>x{}</style></head><body><h1>Title</h1><p>Body text</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "https://example.com/page" }, provider, session, "build");
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("HTTP 200");
    expect(String(r.output)).toContain("Title");
    expect(String(r.output)).toContain("Body text");
    expect(String(r.output)).not.toContain("<h1>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://example.com/page");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("rapporte les erreurs HTTP (404) honnêtement", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404, statusText: "Not Found" }));
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "https://example.com/missing" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/HTTP 404/);
  });

  it("refuse les protocoles non http(s)", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "ftp://example.com/f" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/Unsupported protocol/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse les URLs invalides", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "not a url" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/Invalid URL/);
  });

  it("échoue honnêtement quand le réseau est coupé", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "https://example.com/down" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/webfetch failed|fetch failed/);
  });

  it("supporte le body pour POST", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })
    );
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute(
      "webfetch",
      { url: "https://api.example.com/x", method: "POST", body: '{"a":1}' },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain('{"ok":true}');
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe('{"a":1}');
  });

  it("trone le corps au-delà de 20000 caractères", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("x".repeat(30000), { status: 200, headers: { "content-type": "text/plain" } })
    );
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("webfetch", { url: "https://example.com/big" }, provider, session, "build");
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("[truncated after 20000 characters]");
  });
});
