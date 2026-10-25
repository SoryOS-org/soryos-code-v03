/**
 * @soryos/bus
 * Central event bus for real agent runtime lifecycles.
 */

import { AgentEventType, AgentEventPayload } from "@soryos/schema";

export type EventListener = (event: AgentEventPayload) => void;

export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private wildcardListeners: Set<EventListener> = new Set();

  public on(eventType: AgentEventType | "*", listener: EventListener): () => void {
    if (eventType === "*") {
      this.wildcardListeners.add(listener);
      return () => this.wildcardListeners.delete(listener);
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public off(eventType: string, listener: EventListener | any): void {
    if (eventType === "*") {
      this.wildcardListeners.delete(listener);
    } else {
      this.listeners.get(eventType)?.delete(listener);
    }
  }

  public emit(arg1: string, arg2?: any, arg3?: any): void {
    let sessionId = "global";
    let type: AgentEventType | string = arg1;
    let data: Record<string, unknown> = {};

    if (typeof arg2 === "string") {
      sessionId = arg1;
      type = arg2;
      data = arg3 || {};
    } else if (typeof arg2 === "object" && arg2 !== null) {
      type = arg1;
      data = arg2;
      sessionId = (data.sessionId as string) || "global";
    }

    const payload: AgentEventPayload = {
      sessionId,
      timestamp: new Date().toISOString(),
      type: type as AgentEventType,
      data,
    };

    const specific = this.listeners.get(type);
    if (specific) {
      for (const listener of specific) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${type}:`, err);
        }
      }
    }

    for (const listener of this.wildcardListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[EventBus] Error in wildcard listener for ${type}:`, err);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}

export const globalEventBus = new EventBus();
export const GlobalEventBus = globalEventBus;
