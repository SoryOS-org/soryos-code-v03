/**
 * @soryos/core
 * Foundational abstractions, errors, and lifecycles.
 */

export class SoryOSError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = "SORYOS_INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = "SoryOSError";
    this.code = code;
    this.details = details;
  }
}

export class ExecutionError extends SoryOSError {
  constructor(message: string, details?: unknown) {
    super(message, "EXECUTION_ERROR", details);
    this.name = "ExecutionError";
  }
}

export class PermissionDeniedError extends SoryOSError {
  constructor(message: string, details?: unknown) {
    super(message, "PERMISSION_DENIED", details);
    this.name = "PermissionDeniedError";
  }
}

export class ToolNotFoundError extends SoryOSError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' not found in registry.`, "TOOL_NOT_FOUND");
    this.name = "ToolNotFoundError";
  }
}

export class VerificationFailedError extends SoryOSError {
  constructor(message: string, details?: unknown) {
    super(message, "VERIFICATION_FAILED", details);
    this.name = "VerificationFailedError";
  }
}

export type LifecycleState = "idle" | "initializing" | "running" | "paused" | "completed" | "error" | "aborted";
