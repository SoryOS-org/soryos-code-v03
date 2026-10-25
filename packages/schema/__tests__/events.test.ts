import { describe, it, expect } from "vitest";
import { toSoryOSEvent, translateEvents } from "../src/events";

describe("toSoryOSEvent — flux du planner", () => {
  it("translates status", () => {
    expect(toSoryOSEvent({ type: "status", message: "Analyse…" })).toEqual({
      type: "status",
      message: "Analyse…",
    });
  });

  it("translates text", () => {
    expect(toSoryOSEvent({ type: "text", delta: "hello" })).toEqual({
      type: "text",
      delta: "hello",
    });
  });

  it("translates tool_start into tool_use", () => {
    expect(toSoryOSEvent({ type: "tool_start", id: "s1", name: "read_file", input: { path: "a" } })).toEqual({
      type: "tool_use",
      id: "s1",
      name: "read_file",
      input: { path: "a" },
    });
  });

  it("translates tool_end", () => {
    expect(toSoryOSEvent({ type: "tool_end", id: "s1", output: "ok", isError: false })).toEqual({
      type: "tool_end",
      id: "s1",
      output: "ok",
      isError: false,
    });
  });

  it("translates error", () => {
    expect(toSoryOSEvent({ type: "error", message: "boom" })).toEqual({
      type: "error",
      message: "boom",
    });
  });

  it("translates files_changed into file_changed", () => {
    expect(toSoryOSEvent({ type: "files_changed", paths: ["src/a.ts"] })).toEqual({
      type: "file_changed",
      path: "src/a.ts",
      action: "changed",
    });
  });

  it("ignores the planner done (the canonical done means the run is over)", () => {
    expect(toSoryOSEvent({ type: "done" })).toBeNull();
    expect(toSoryOSEvent({ type: "done", usage: { input: 10, output: 20 } })).toBeNull();
  });

  it("translates agent.completed (bus) into done", () => {
    expect(toSoryOSEvent({ type: "agent.completed", sessionId: "s", data: {} })).toEqual({ type: "done" });
  });

  it("ignores the bus tool events (they duplicate tool_use)", () => {
    expect(toSoryOSEvent({ type: "tool.started", data: { toolName: "read_file" } })).toBeNull();
    expect(toSoryOSEvent({ type: "tool.completed", data: { toolName: "read_file" } })).toBeNull();
  });
});

describe("toSoryOSEvent — vocabulaire du bus", () => {
  it("translates agent.started into status", () => {
    expect(toSoryOSEvent({ type: "agent.started", sessionId: "s", data: {} })).toEqual({
      type: "status",
      message: "Agent started",
    });
  });

  it("translates agent.completed into done", () => {
    expect(toSoryOSEvent({ type: "agent.completed", sessionId: "s", data: {} })).toEqual({ type: "done" });
  });

  it("translates agent.failed into error", () => {
    expect(toSoryOSEvent({ type: "agent.failed", sessionId: "s", data: { message: "nope" } })).toEqual({
      type: "error",
      message: "nope",
    });
  });

  it("translates permission.requested", () => {
    expect(
      toSoryOSEvent({
        type: "permission.requested",
        sessionId: "s",
        data: { requestId: "r1", toolName: "shell_command" },
      }),
    ).toEqual({ type: "permission_requested", requestId: "r1", toolName: "shell_command" });
  });

  it("translates question.asked", () => {
    expect(
      toSoryOSEvent({
        type: "question.asked",
        sessionId: "s",
        data: { requestId: "q1", questions: [{ question: "Why?" }] },
      }),
    ).toEqual({ type: "question_asked", requestId: "q1", questions: [{ question: "Why?" }] });
  });

  it("translates file.changed", () => {
    expect(
      toSoryOSEvent({ type: "file.changed", sessionId: "s", data: { path: "a.ts", action: "write" } }),
    ).toEqual({ type: "file_changed", path: "a.ts", action: "write" });
  });

  it("returns null for unknown events", () => {
    expect(toSoryOSEvent({ type: "mcp.tools.registered", data: {} })).toBeNull();
    expect(toSoryOSEvent(null)).toBeNull();
    expect(toSoryOSEvent("nope")).toBeNull();
  });
});

describe("translateEvents", () => {
  it("keeps only the canonical events and preserves the order", () => {
    const out = translateEvents([
      { type: "status", message: "a" },
      { type: "tool.started", data: {} },
      { type: "text", delta: "b" },
      { type: "unknown", data: {} },
    ]);
    expect(out.map((e) => e.type)).toEqual(["status", "text"]);
  });
});
