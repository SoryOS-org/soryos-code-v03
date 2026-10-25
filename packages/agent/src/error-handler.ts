/**
 * @soryos/agent
 * Error Recovery System - Comprehensive error classification and recovery
 * 
 * Inspired by Vibra Code's onFailure handler
 * Provides:
 * - Error classification (10+ error types)
 * - Helpful user messages for each error type
 * - Session state preservation on errors
 * - Auto-retry mechanism for transient errors
 * - Error recovery suggestions
 */

import { GlobalEventBus } from '@soryos/bus';
import { SessionStore } from '@soryos/session';

export interface JobQueue {
  [key: string]: unknown;
}

// ============================================================================
// Error Types and Classification
// ============================================================================

/**
 * Error classification types
 */
export type ErrorType =
  | 'timeout'
  | 'sandbox_terminated'
  | 'network_error'
  | 'rate_limit'
  | 'permission_denied'
  | 'invalid_input'
  | 'resource_exhausted'
  | 'internal_error'
  | 'validation_error'
  | 'canceled'
  | 'sandbox_not_ready'
  | 'session_expired'
  | 'git_error'
  | 'build_failed'
  | 'unknown';

/**
 * Classified error with type and recovery information
 */
export interface ClassifiedError {
  type: ErrorType;
  message: string;
  code: string;
  isRetryable: boolean;
  retryDelay?: number;
  maxRetries?: number;
  userMessage: string;
  recoverySuggestions: string[];
  originalError?: Error;
  timestamp: number;
  sessionId?: string;
  jobId?: string;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  error: ClassifiedError;
  shouldRetry: boolean;
  shouldPreserveSession: boolean;
  shouldNotifyUser: boolean;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error classes for better error handling
 */
export class SandboxTerminatedError extends Error {
  constructor(message: string = 'Sandbox was terminated') {
    super(message);
    this.name = 'SandboxTerminatedError';
  }
}

export class SandboxTimeoutError extends Error {
  constructor(message: string = 'Sandbox execution timed out') {
    super(message);
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxNotReadyError extends Error {
  constructor(message: string = 'Sandbox is not ready') {
    super(message);
    this.name = 'SandboxNotReadyError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message: string = 'Session has expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ResourceExhaustedError extends Error {
  constructor(message: string = 'Resource exhausted') {
    super(message);
    this.name = 'ResourceExhaustedError';
  }
}

export class JobCanceledError extends Error {
  constructor(message: string = 'Job was canceled') {
    super(message);
    this.name = 'JobCanceledError';
  }
}

// ============================================================================
// Error Classifier
// ============================================================================

/**
 * Error classifier that analyzes errors and provides classification
 */
export class ErrorClassifier {
  private static readonly ERROR_PATTERNS: Record<ErrorType, {
    patterns: (RegExp | string)[];
    code: string;
    isRetryable: boolean;
    userMessage: string;
    recoverySuggestions: string[];
    retryDelay?: number;
    maxRetries?: number;
  }> = {
    timeout: {
      patterns: [/timeout/i, /timed out/i, /exceeded timeout/i],
      code: 'AGENT_TIMEOUT',
      isRetryable: true,
      userMessage: 'The operation took too long to complete. Please try again with a simpler request or increase the timeout.',
      recoverySuggestions: [
        'Retry with a shorter or simpler request',
        'Increase the timeout limit',
        'Check for infinite loops in your code',
        'Split the task into smaller steps'
      ],
      retryDelay: 1000,
      maxRetries: 3
    },
    sandbox_terminated: {
      patterns: [/sandbox.*terminated/i, /sandbox.*stopped/i, /sandbox.*killed/i, /e2b.*terminated/i],
      code: 'SANDBOX_TERMINATED',
      isRetryable: true,
      userMessage: 'The sandbox environment was terminated. A new sandbox will be created automatically.',
      recoverySuggestions: [
        'Creating a new sandbox session',
        'Check sandbox logs for termination reason',
        'Ensure sufficient credits/quota',
        'Reduce resource usage'
      ],
      retryDelay: 5000,
      maxRetries: 5
    },
    sandbox_not_ready: {
      patterns: [/sandbox.*not ready/i, /sandbox.*initializing/i, /waiting for sandbox/i],
      code: 'SANDBOX_NOT_READY',
      isRetryable: true,
      userMessage: 'The sandbox is still initializing. Please wait a moment and try again.',
      recoverySuggestions: [
        'Wait for sandbox to finish initializing',
        'Check sandbox creation logs',
        'Verify template configuration'
      ],
      retryDelay: 2000,
      maxRetries: 10
    },
    network_error: {
      patterns: [/network/i, /connection/i, /socket/i, /fetch.*failed/i, /request.*failed/i, /ECONNREFUSED/i, /ETIMEDOUT/i, /ENOTFOUND/i],
      code: 'NETWORK_ERROR',
      isRetryable: true,
      userMessage: 'A network error occurred. Please check your internet connection and try again.',
      recoverySuggestions: [
        'Check internet connection',
        'Verify API endpoints are reachable',
        'Retry the operation',
        'Check firewall/proxy settings'
      ],
      retryDelay: 2000,
      maxRetries: 5
    },
    rate_limit: {
      patterns: [/rate limit/i, /too many requests/i, /429/i, /quota.*exceeded/i, /limit.*reached/i],
      code: 'RATE_LIMIT',
      isRetryable: true,
      userMessage: 'Rate limit exceeded. Please wait a moment before trying again.',
      recoverySuggestions: [
        'Wait before retrying',
        'Check API quota',
        'Upgrade plan if needed',
        'Implement exponential backoff'
      ],
      retryDelay: 10000,
      maxRetries: 10
    },
    permission_denied: {
      patterns: [/permission.*denied/i, /access.*denied/i, /403/i, /unauthorized/i, /forbidden/i],
      code: 'PERMISSION_DENIED',
      isRetryable: false,
      userMessage: 'Access denied. You do not have permission to perform this action.',
      recoverySuggestions: [
        'Check your permissions',
        'Authenticate with valid credentials',
        'Contact administrator for access',
        'Verify API keys are correct'
      ]
    },
    invalid_input: {
      patterns: [/invalid.*input/i, /bad request/i, /400/i, /malformed/i, /parse.*error/i],
      code: 'INVALID_INPUT',
      isRetryable: false,
      userMessage: 'Invalid input. Please check your request parameters.',
      recoverySuggestions: [
        'Validate input parameters',
        'Check request format',
        'Review API documentation'
      ]
    },
    resource_exhausted: {
      patterns: [/out of memory/i, /memory.*limit/i, /disk.*full/i, /storage.*exhausted/i, /quota.*exceeded/i],
      code: 'RESOURCE_EXHAUSTED',
      isRetryable: false,
      userMessage: 'Resource limit reached. Please free up resources or upgrade your plan.',
      recoverySuggestions: [
        'Free up memory or disk space',
        'Upgrade to a higher tier',
        'Optimize resource usage',
        'Clean up unused resources'
      ]
    },
    internal_error: {
      patterns: [/internal.*error/i, /server.*error/i, /500/i, /unexpected.*error/i, /unknown.*error/i],
      code: 'INTERNAL_ERROR',
      isRetryable: true,
      userMessage: 'An internal error occurred. Please try again later.',
      recoverySuggestions: [
        'Retry the operation',
        'Check system logs',
        'Report the issue to support',
        'Wait and try again'
      ],
      retryDelay: 5000,
      maxRetries: 3
    },
    validation_error: {
      patterns: [/validation.*failed/i, /schema.*validation/i, /zod.*error/i, /invalid.*schema/i],
      code: 'VALIDATION_ERROR',
      isRetryable: false,
      userMessage: 'Validation failed. Please check the input data format.',
      recoverySuggestions: [
        'Validate input against schema',
        'Check required fields',
        'Verify data types',
        'Review validation rules'
      ]
    },
    canceled: {
      patterns: [/canceled/i, /aborted/i, /cancelled/i, /user.*canceled/i],
      code: 'JOB_CANCELED',
      isRetryable: false,
      userMessage: 'The operation was canceled.',
      recoverySuggestions: [
        'Start a new operation',
        'Check why it was canceled',
        'Review cancellation reason'
      ]
    },
    session_expired: {
      patterns: [/session.*expired/i, /session.*timeout/i, /token.*expired/i],
      code: 'SESSION_EXPIRED',
      isRetryable: false,
      userMessage: 'Your session has expired. Please start a new session.',
      recoverySuggestions: [
        'Start a new session',
        'Re-authenticate',
        'Save work before session ends'
      ]
    },
    git_error: {
      patterns: [/git.*error/i, /commit.*failed/i, /push.*failed/i, /merge.*conflict/i],
      code: 'GIT_ERROR',
      isRetryable: false,
      userMessage: 'A Git operation failed. Please check the repository state.',
      recoverySuggestions: [
        'Check Git status',
        'Resolve merge conflicts',
        'Verify repository permissions',
        'Check network connectivity'
      ]
    },
    build_failed: {
      patterns: [/build.*failed/i, /compilation.*error/i, /npm.*error/i, /yarn.*error/i],
      code: 'BUILD_FAILED',
      isRetryable: false,
      userMessage: 'Build failed. Please check the build logs for errors.',
      recoverySuggestions: [
        'Check build configuration',
        'Review dependencies',
        'Fix compilation errors',
        'Check environment variables'
      ]
    },
    unknown: {
      patterns: [],
      code: 'UNKNOWN_ERROR',
      isRetryable: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      recoverySuggestions: [
        'Retry the operation',
        'Check system status',
        'Report the issue',
        'Review logs'
      ]
    }
  };

  /**
   * Classify an error based on its message and type
   */
  classify(error: Error, context: { sessionId?: string; jobId?: string } = {}): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    const combinedText = `${errorName} ${errorMessage}`;

    // Check for custom error types first
    if (error instanceof SandboxTerminatedError) {
      return this.createClassification('sandbox_terminated', error, context);
    }
    if (error instanceof SandboxTimeoutError) {
      return this.createClassification('timeout', error, context);
    }
    if (error instanceof SandboxNotReadyError) {
      return this.createClassification('sandbox_not_ready', error, context);
    }
    if (error instanceof SessionExpiredError) {
      return this.createClassification('session_expired', error, context);
    }
    if (error instanceof RateLimitError) {
      return this.createClassification('rate_limit', error, context);
    }
    if (error instanceof PermissionDeniedError) {
      return this.createClassification('permission_denied', error, context);
    }
    if (error instanceof ValidationError) {
      return this.createClassification('validation_error', error, context);
    }
    if (error instanceof ResourceExhaustedError) {
      return this.createClassification('resource_exhausted', error, context);
    }
    if (error instanceof JobCanceledError) {
      return this.createClassification('canceled', error, context);
    }

    // Find matching error type based on patterns
    for (const [errorType, config] of Object.entries(ErrorClassifier.ERROR_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (typeof pattern === 'string') {
          if (combinedText.includes(pattern.toLowerCase())) {
            return this.createClassification(errorType as ErrorType, error, context);
          }
        } else if (pattern.test(combinedText)) {
          return this.createClassification(errorType as ErrorType, error, context);
        }
      }
    }

    // Default to unknown
    return this.createClassification('unknown', error, context);
  }

  /**
   * Create error classification from type
   */
  private createClassification(
    type: ErrorType,
    error: Error,
    context: { sessionId?: string; jobId?: string }
  ): ErrorClassification {
    const config = ErrorClassifier.ERROR_PATTERNS[type];
    const classifiedError: ClassifiedError = {
      type,
      message: error.message,
      code: config.code,
      isRetryable: config.isRetryable,
      retryDelay: config.retryDelay,
      maxRetries: config.maxRetries,
      userMessage: config.userMessage,
      recoverySuggestions: config.recoverySuggestions,
      originalError: error,
      timestamp: Date.now(),
      sessionId: context.sessionId,
      jobId: context.jobId
    };

    return {
      error: classifiedError,
      shouldRetry: classifiedError.isRetryable,
      shouldPreserveSession: type !== 'session_expired' && type !== 'permission_denied',
      shouldNotifyUser: true
    };
  }
}

// ============================================================================
// Error Recovery Manager
// ============================================================================

/**
 * Error recovery manager handles error classification, retry logic, and session preservation
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private classifier: ErrorClassifier;
  private retryCounts: Map<string, number> = new Map();
  private sessionStore: SessionStore;
  private jobQueue: JobQueue | null = null;

  private constructor(sessionStore: SessionStore) {
    this.classifier = new ErrorClassifier();
    this.sessionStore = sessionStore;
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(sessionStore: SessionStore): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager(sessionStore);
    }
    return ErrorRecoveryManager.instance;
  }

  /**
   * Set job queue for retry operations
   */
  setJobQueue(queue: JobQueue): void {
    this.jobQueue = queue;
  }

  /**
   * Handle an error and determine recovery actions
   */
  async handleError(
    error: Error,
    context: {
      sessionId?: string;
      jobId?: string;
      action: string;
      retryable?: boolean;
    }
  ): Promise<ErrorClassification> {
    const { sessionId, jobId, action } = context;

    // Classify the error
    const classification = this.classifier.classify(error, { sessionId, jobId });
    const { error: classifiedError, shouldRetry, shouldPreserveSession, shouldNotifyUser } = classification;

    // Log the error
    this.logError(classifiedError);

    // Emit error event
    GlobalEventBus.emit('agent.error', {
      sessionId,
      jobId,
      action,
      error: classifiedError
    });

    // Handle session preservation
    if (shouldPreserveSession && sessionId) {
      await this.preserveSessionState(sessionId, classifiedError);
    }

    // Handle retry if applicable
    if (shouldRetry && jobId && this.jobQueue) {
      await this.handleRetry(jobId, classifiedError);
    }

    // Notify user if needed
    if (shouldNotifyUser) {
      this.notifyUser(classifiedError);
    }

    return classification;
  }

  /**
   * Log error with classification
   */
  private logError(error: ClassifiedError): void {
    console.error(`[ErrorRecovery] ${error.code}: ${error.message}`);
    console.error(`[ErrorRecovery] Type: ${error.type}, Retryable: ${error.isRetryable}`);
    if (error.originalError?.stack) {
      console.error(`[ErrorRecovery] Stack: ${error.originalError.stack}`);
    }
  }

  /**
   * Preserve session state on error
   */
  private async preserveSessionState(sessionId: string, error: ClassifiedError): Promise<void> {
    try {
      const session = await this.sessionStore.get(sessionId);
      if (session) {
        // Add error to session history
        session.errors = session.errors || [];
        session.errors.push({
          timestamp: new Date(error.timestamp).toISOString(),
          type: error.type,
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          recoverySuggestions: error.recoverySuggestions
        });

        // Update sandbox state based on error type
        if (error.type === 'sandbox_terminated' || error.type === 'sandbox_not_ready') {
          session.sandbox_state = 'paused';
        } else if (error.type === 'session_expired') {
          session.sandbox_state = 'dead';
        } else if (!error.isRetryable) {
          session.agent_running = false;
        }

        await this.sessionStore.save(session);
        console.log(`[ErrorRecovery] Session ${sessionId} state preserved with error`);
      }
    } catch (preserveError) {
      console.error(`[ErrorRecovery] Failed to preserve session state: ${preserveError}`);
    }
  }

  /**
   * Handle job retry with exponential backoff
   */
  private async handleRetry(jobId: string, error: ClassifiedError): Promise<void> {
    const retryCount = this.retryCounts.get(jobId) || 0;
    const maxRetries = error.maxRetries || 3;

    if (retryCount >= maxRetries) {
      console.log(`[ErrorRecovery] Job ${jobId} max retries (${maxRetries}) reached`);
      return;
    }

    const retryDelay = error.retryDelay || this.calculateExponentialBackoff(retryCount);
    console.log(`[ErrorRecovery] Retrying job ${jobId} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);

    // Update retry count
    this.retryCounts.set(jobId, retryCount + 1);

    // Emit retry event
    GlobalEventBus.emit('agent.retry', {
      jobId,
      attempt: retryCount + 1,
      maxRetries,
      delay: retryDelay,
      error: error.message
    });

    // If we have a job queue, it should handle the retry
    // Otherwise, we'll just log and wait
    if (this.jobQueue) {
      // The job queue will handle the actual retry
      console.log(`[ErrorRecovery] Job ${jobId} queued for retry`);
    } else {
      // Simple delay for demonstration
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateExponentialBackoff(attempt: number): number {
    const baseDelay = 100; // 100ms base
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = delay * 0.1 * Math.random(); // Add 10% jitter
    return delay + jitter;
  }

  /**
   * Notify user about the error
   */
  private notifyUser(error: ClassifiedError): void {
    // Emit user notification event
    GlobalEventBus.emit('agent.notification', {
      type: 'error',
      title: `Error: ${error.code}`,
      message: error.userMessage,
      suggestions: error.recoverySuggestions,
      timestamp: error.timestamp,
      sessionId: error.sessionId
    });

    console.log(`[ErrorRecovery] User notified: ${error.userMessage}`);
  }

  /**
   * Reset retry count for a job
   */
  resetRetryCount(jobId: string): void {
    this.retryCounts.delete(jobId);
  }

  /**
   * Clear all retry counts
   */
  clearRetryCounts(): void {
    this.retryCounts.clear();
  }

  /**
   * Get retry count for a job
   */
  getRetryCount(jobId: string): number {
    return this.retryCounts.get(jobId) || 0;
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: Error): boolean {
    const classification = this.classifier.classify(error);
    return classification.error.isRetryable;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: Error): string {
    const classification = this.classifier.classify(error);
    return classification.error.userMessage;
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoverySuggestions(error: Error): string[] {
    const classification = this.classifier.classify(error);
    return classification.error.recoverySuggestions;
  }
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

/**
 * Global error recovery manager instance
 */
let globalErrorRecoveryManager: ErrorRecoveryManager | null = null;

/**
 * Get or initialize global error recovery manager
 */
export function getErrorRecoveryManager(sessionStore: SessionStore): ErrorRecoveryManager {
  if (!globalErrorRecoveryManager) {
    globalErrorRecoveryManager = ErrorRecoveryManager.getInstance(sessionStore);
  }
  return globalErrorRecoveryManager;
}

/**
 * Set global error recovery manager
 */
export function setErrorRecoveryManager(manager: ErrorRecoveryManager): void {
  globalErrorRecoveryManager = manager;
}

/**
 * Classify an error (convenience function)
 */
export function classifyError(error: Error, context?: { sessionId?: string; jobId?: string }): ErrorClassification {
  const classifier = new ErrorClassifier();
  return classifier.classify(error, context);
}

/**
 * Handle an error with default recovery (convenience function)
 */
export async function handleError(
  error: Error,
  context: {
    sessionId?: string;
    jobId?: string;
    action: string;
    retryable?: boolean;
  }
): Promise<ErrorClassification> {
  // Create a temporary session store for classification only
  // In production, use the real session store
  const tempSessionStore = {
    get: async () => null,
    save: async () => {},
    delete: async () => {}
  } as any;
  
  const manager = ErrorRecoveryManager.getInstance(tempSessionStore);
  return manager.handleError(error, context);
}

