import { describe, expect, it } from "vitest";
import { applyEdit, normalizeForMatch } from "../src/edit-matcher";

describe("normalizeForMatch", () => {
  it("convertit les guillemets typographiques en droits", () => {
    expect(normalizeForMatch("‘hello’ “world”")).toBe("'hello' \"world\"");
  });
  it("convertit les tirets Unicode en tiret standard", () => {
    expect(normalizeForMatch("a–b—c−d")).toBe("a-b-c-d");
  });
  it("convertit les espaces Unicode en espace standard", () => {
    expect(normalizeForMatch("a b c")).toBe("a b c");
  });
});

describe("applyEdit — palier 1 (bytes exacts)", () => {
  it("remplace une occurrence unique", () => {
    const out = applyEdit("hello world", "world", "there");
    expect(out.error).toBeUndefined();
    expect(out.content).toBe("hello there");
    expect(out.replacements).toBe(1);
    expect(out.applied).toBe(1);
  });

  it("échoue honnêtement sur 0 correspondance", () => {
    const out = applyEdit("hello world", "missing", "x");
    expect(out.error).toMatch(/Could not find the target/);
    expect(out.replacements).toBe(0);
  });

  it("échoue honnêtement sur correspondances multiples sans allOccurrences", () => {
    const out = applyEdit("a b a b", "a", "z");
    expect(out.error).toMatch(/Found 2 matches/);
    expect(out.replacements).toBe(2);
    expect(out.applied).toBe(0);
  });

  it("remplace tout avec allOccurrences=true", () => {
    const out = applyEdit("a b a b", "a", "z", true);
    expect(out.error).toBeUndefined();
    expect(out.content).toBe("z b z b");
    expect(out.applied).toBe(2);
  });

  it("refuse cible vide", () => {
    expect(applyEdit("abc", "", "x").error).toMatch(/must not be empty/);
  });

  it("refuse cible == remplacement", () => {
    expect(applyEdit("abc", "abc", "abc").error).toMatch(/identical/);
  });
});

describe("applyEdit — palier 2 (unicité normalisée)", () => {
  it("match malgré des guillemets typographiques dans la cible", () => {
    const source = "const s = ‘quoted value’;";
    const out = applyEdit(source, "const s = 'quoted value';", 'const s = "real";');
    expect(out.error).toBeUndefined();
    expect(out.content).toBe('const s = "real";');
    expect(out.replacements).toBe(1);
  });

  it("match malgré des tirets Unicode", () => {
    const source = "range = a–b";
    const out = applyEdit(source, "range = a-b", "range = c-d");
    expect(out.error).toBeUndefined();
    expect(out.content).toBe("range = c-d");
  });
});

describe("applyEdit — palier 3 (lignes, trailing whitespace)", () => {
  it("match une cible multi-lignes dont les lignes ont du trailing whitespace", () => {
    const source = "line one   \nline two   \nline three\n";
    const out = applyEdit(source, "line one\nline two\n", "first\nsecond\n");
    expect(out.error).toBeUndefined();
    expect(out.content).toBe("first\nsecond\nline three\n");
  });

  it("préserve les fins de ligne CRLF de la région appariée", () => {
    const source = "alpha\r\nbeta\r\ngamma\r\n";
    const out = applyEdit(source, "alpha\nbeta\n", "one\ntwo\n");
    expect(out.error).toBeUndefined();
    expect(out.content).toBe("one\r\ntwo\r\ngamma\r\n");
  });

  it("rapporte les lignes candidates quand la cible n'est pas trouvée", () => {
    const out = applyEdit("const x = 1;\nconst y = 2;\n", "const z = 99;", "x");
    expect(out.error).toMatch(/Could not find the target/);
  });

  it("échoue si l'édition laisse le contenu inchangé", () => {
    const out = applyEdit("abc", "abc", "abc", true);
    expect(out.error).toMatch(/identical/);
  });
});
