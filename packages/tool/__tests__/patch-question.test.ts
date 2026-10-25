import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry } from "@soryos/tool";
import {
  parsePatch,
  deriveUpdate,
  createQuestionRequest,
  resolveQuestionRequest,
  cancelQuestionRequest,
  hasPendingQuestionRequest,
  formatAnswers,
  validateQuestions,
  QUESTION_TIMEOUT_MS,
} from "@soryos/tool";
import { globalEventBus } from "@soryos/bus";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import type { SessionData } from "@soryos/schema";

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

function makeSession(id: string): SessionData {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  session.model = "gemini-3.8-flash";
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

function read(p: string) {
  return fs.readFileSync(path.join(tmp, p), "utf8");
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-patch-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed");
  provider = new LocalExecutionProvider(tmp);
  await provider.init(tmp);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("parsePatch — validation honnête", () => {
  it("refuse un patch sans Begin/End Patch", () => {
    const r = parsePatch("juste du texte");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("*** Begin Patch");
  });

  it("refuse un header invalide avec numéro de ligne", () => {
    const r = parsePatch("*** Begin Patch\n*** Rename File: x\n*** End Patch");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("line 2");
  });

  it("accepte Add + Update + Move + Delete", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: hello.txt",
      "+Hello world",
      "*** Update File: a.txt",
      "*** Move to: b.txt",
      "@@ def greet():",
      '-print("Hi")',
      '+print("Hello!")',
      "*** Delete File: old.txt",
      "*** End Patch",
    ].join("\n");
    const r = parsePatch(patch);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hunks.map((h) => h.type)).toEqual(["add", "update", "delete"]);
      const update = r.hunks[1];
      if (update.type === "update") {
        expect(update.movePath).toBe("b.txt");
        expect(update.chunks[0].changeContext).toBe("def greet():");
      }
    }
  });

  it("refuse une ligne non + dans Add File", () => {
    const r = parsePatch("*** Begin Patch\n*** Add File: x.txt\nligne sans plus\n*** End Patch");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("starting with '+'");
  });
});

describe("deriveUpdate — application des chunks", () => {
  it("remplace les lignes attendues", () => {
    const original = "alpha\nbeta\ngamma\n";
    const derived = deriveUpdate("f", [{ oldLines: ["beta"], newLines: ["BETA"] }], original);
    expect(derived).toBe("alpha\nBETA\ngamma\n");
  });

  it("match normalisé (guillemets typographiques)", () => {
    const original = "const s = ‘quoted’;\n";
    const derived = deriveUpdate("f", [{ oldLines: ["const s = 'quoted';"], newLines: ['const s = "real";'] }], original);
    expect(derived).toBe('const s = "real";\n');
  });

  it("échoue honnêtement si le contexte n'existe pas", () => {
    expect(() => deriveUpdate("f", [{ oldLines: ["introuvable"], newLines: ["x"] }], "a\nb\n")).toThrow(
      /Failed to find expected lines/
    );
  });
});

describe("patch_file via ToolExecutor (disque réel)", () => {
  it("Add File : crée le fichier vérifié sur disque", async () => {
    const session = makeSession("p-add");
    const r = await executor.execute(
      "patch_file",
      { patch: "*** Begin Patch\n*** Add File: created.txt\n+ligne1\n+ligne2\n*** End Patch" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(read("created.txt")).toBe("ligne1\nligne2\n");
    expect(String(r.output)).toContain("A created.txt");
  });

  it("Update + Move : modifie et renomme réellement", async () => {
    fs.writeFileSync(path.join(tmp, "move-src.txt"), "avant\n");
    const session = makeSession("p-move");
    const r = await executor.execute(
      "patch_file",
      {
        patch:
          "*** Begin Patch\n*** Update File: move-src.txt\n*** Move to: move-dst.txt\n@@\n-avant\n+après\n*** End Patch",
      },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(fs.existsSync(path.join(tmp, "move-src.txt"))).toBe(false);
    expect(read("move-dst.txt")).toBe("après\n");
  });

  it("Delete File : supprime réellement", async () => {
    fs.writeFileSync(path.join(tmp, "to-delete.txt"), "x");
    const session = makeSession("p-del");
    const r = await executor.execute(
      "patch_file",
      { patch: "*** Begin Patch\n*** Delete File: to-delete.txt\n*** End Patch" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(fs.existsSync(path.join(tmp, "to-delete.txt"))).toBe(false);
  });

  it("hunk invalide en préparation : AUCUN fichier touché (prepare-before-apply)", async () => {
    fs.writeFileSync(path.join(tmp, "untouched.txt"), "original\n");
    const session = makeSession("p-atomic");
    const r = await executor.execute(
      "patch_file",
      {
        patch:
          "*** Begin Patch\n*** Add File: should-not-exist.txt\n+ok\n*** Update File: untouched.txt\n@@\n-introuvable\n+x\n*** End Patch",
      },
      provider, session, "build"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("patch verification failed");
    expect(fs.existsSync(path.join(tmp, "should-not-exist.txt"))).toBe(false);
    expect(read("untouched.txt")).toBe("original\n");
  });

  it("échec en cours d'application : rapporte les opérations déjà faites", async () => {
    fs.mkdirSync(path.join(tmp, "blocked-dir"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "blocked-dir", "child.txt"), "c");
    fs.writeFileSync(path.join(tmp, "ok-src.txt"), "a\n");
    const session = makeSession("p-partial");
    // 1er op : update valide (réussira) ; 2e op : Add sur un chemin répertoire (EISDIR à l'écriture)
    const r = await executor.execute(
      "patch_file",
      {
        patch:
          "*** Begin Patch\n*** Update File: ok-src.txt\n@@\n-a\n+b\n*** Add File: blocked-dir\n+x\n*** End Patch",
      },
      provider, session, "build"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("Completed before failure: M ok-src.txt");
    expect(read("ok-src.txt")).toBe("b\n");
    fs.rmSync(path.join(tmp, "blocked-dir"), { recursive: true, force: true });
    fs.rmSync(path.join(tmp, "ok-src.txt"));
  });

  it("mode plan : patch refusé par permissions", async () => {
    const session = makeSession("p-plan");
    const r = await executor.execute(
      "patch_file",
      { patch: "*** Begin Patch\n*** Add File: no.txt\n+x\n*** End Patch" },
      provider, session, "plan"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("PERMISSION DENIED");
    expect(fs.existsSync(path.join(tmp, "no.txt"))).toBe(false);
  });

  it("accepte l'alias patchText", async () => {
    const session = makeSession("p-alias");
    const r = await executor.execute(
      "patch_file",
      { patchText: "*** Begin Patch\n*** Add File: aliased.txt\n+ok\n*** End Patch" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(read("aliased.txt")).toBe("ok\n");
  });
});

describe("question — flux interactif", () => {
  let askEvents: any[] = [];
  let off: (() => void) | null = null;

  beforeEach(() => {
    askEvents = [];
    off = globalEventBus.on("question.asked", (e: any) => askEvents.push(e));
  });
  afterEach(() => {
    off?.();
    off = null;
  });

  it("résolution via resolveQuestionRequest : réponses dans la sortie", async () => {
    const session = makeSession("q-a");
    const execPromise = executor.execute(
      "question",
      {
        questions: [
          {
            question: "Quelle UI ?",
            header: "UI",
            options: [{ label: "Tailwind (Recommended)" }, { label: "CSS modules" }],
          },
        ],
      },
      provider, session, "build"
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(askEvents).toHaveLength(1);
    const { requestId, questions } = askEvents[0].data;
    expect(questions[0].question).toContain("Quelle UI");
    expect(hasPendingQuestionRequest(requestId)).toBe(true);

    expect(resolveQuestionRequest(requestId, [["Tailwind (Recommended)"]])).toBe(true);
    const r = await execPromise;
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("User has answered your questions");
    expect(String(r.output)).toContain("Tailwind (Recommended)");
  });

  it("annulation : message honnête de dismissal", async () => {
    const session = makeSession("q-cancel");
    const execPromise = executor.execute(
      "question",
      { questions: [{ question: "Confirmer ?" }] },
      provider, session, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(cancelQuestionRequest(askEvents[0].data.requestId)).toBe(true);
    const r = await execPromise;
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("dismissed");
  });

  it("questions invalides : erreur honnête sans ask", async () => {
    const session = makeSession("q-invalid");
    const r = await executor.execute("question", { questions: [] }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("non-empty array");
    expect(askEvents).toHaveLength(0);
  });

  it("timeout (requête directe) → annulé", async () => {
    const { requestId, answers } = createQuestionRequest("s", [{ question: "?" }], 100);
    expect(hasPendingQuestionRequest(requestId)).toBe(true);
    const a = await answers;
    expect(a).toBeNull();
    expect(hasPendingQuestionRequest(requestId)).toBe(false);
  });

  it("formatAnswers + validateQuestions unitaires", () => {
    const v = validateQuestions([{ question: "Q1", options: [{ label: "A" }, { label: "bad" }] }]);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.questions[0].options).toEqual([{ label: "A", description: undefined }, { label: "bad", description: undefined }]);
      // l'option sans label string est filtrée dans le map? non — filter garde label string only
    }
    expect(formatAnswers([{ question: "Q1" }], [["A"]])).toContain('"Q1"="A"');
    expect(formatAnswers([{ question: "Q1" }], [[]])).toContain("Unanswered");
    expect(validateQuestions([]).ok).toBe(false);
    expect(validateQuestions([{ options: [] }]).ok).toBe(false);
    expect(QUESTION_TIMEOUT_MS).toBe(120_000);
  });
});
