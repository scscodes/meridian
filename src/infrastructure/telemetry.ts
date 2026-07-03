/**
 * Telemetry & Structured Logging Infrastructure
 *
 * Tracks signal events for command dispatch (started / completed / failed),
 * emitted by the router's observability middleware. Local-only: sinks write
 * to memory or the developer console — nothing leaves the machine.
 */

import { AppError, CommandName } from "../types";
import { TELEMETRY_EVENT_KINDS } from "../constants";
import { ErrorCode } from "./error-codes";

// ============================================================================
// Telemetry Event Types
// ============================================================================

/** Event kind discriminator for type-safe event dispatch. */
export type TelemetryEventKind =
  | typeof TELEMETRY_EVENT_KINDS.COMMAND_STARTED
  | typeof TELEMETRY_EVENT_KINDS.COMMAND_COMPLETED
  | typeof TELEMETRY_EVENT_KINDS.COMMAND_FAILED;

/**
 * Command execution event payload.
 */
export interface CommandEventPayload {
  commandName: CommandName | string;
  duration?: number; // milliseconds
  outcome?: "success" | "failure" | "timeout" | "cancelled";
  error?: {
    code: ErrorCode | string;
    message: string;
  };
  frequency?: number; // how many times this command has been executed in this session
}

/**
 * A single telemetry event: kind + structured payload.
 */
export interface TelemetryEvent {
  kind: TelemetryEventKind;
  payload: CommandEventPayload;
  timestamp: number; // Unix timestamp in milliseconds
  sessionId?: string; // Session identifier for correlation
}

/**
 * Telemetry sink: receives events from the telemetry tracker.
 */
export interface TelemetrySink {
  emit(event: TelemetryEvent): void | Promise<void>;
  flush?(): Promise<void>;
}

// ============================================================================
// Telemetry Tracker
// ============================================================================

/**
 * Tracks command lifecycle events. Emits only signal events
 * (state changes, errors), NOT verbose debug logs.
 *
 * Usage:
 *   telemetry.trackCommandStarted('git.status');
 *   // ... operation ...
 *   telemetry.trackCommandCompleted('git.status', 125, 'success');
 */
export class TelemetryTracker {
  private sink: TelemetrySink;
  private sessionId: string;
  private commandFrequency: Map<string, number> = new Map();

  constructor(sink: TelemetrySink, sessionId?: string) {
    this.sink = sink;
    this.sessionId = sessionId || this.generateSessionId();
  }

  /**
   * Track command execution start.
   */
  trackCommandStarted(commandName: CommandName | string): void {
    this.emit({
      kind: TELEMETRY_EVENT_KINDS.COMMAND_STARTED,
      payload: { commandName },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    });
  }

  /**
   * Track command execution completion.
   */
  trackCommandCompleted(
    commandName: CommandName | string,
    duration: number,
    outcome: "success" | "failure" | "timeout" | "cancelled" = "success"
  ): void {
    const frequency = this.bumpFrequency(commandName);
    this.emit({
      kind: TELEMETRY_EVENT_KINDS.COMMAND_COMPLETED,
      payload: { commandName, duration, outcome, frequency },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    });
  }

  /**
   * Track command execution failure.
   */
  trackCommandFailed(
    commandName: CommandName | string,
    duration: number,
    error: AppError
  ): void {
    const frequency = this.bumpFrequency(commandName);
    this.emit({
      kind: TELEMETRY_EVENT_KINDS.COMMAND_FAILED,
      payload: {
        commandName,
        duration,
        outcome: "failure",
        error: { code: error.code, message: error.message },
        frequency,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    });
  }

  /**
   * Flush any pending events to the sink.
   */
  async flush(): Promise<void> {
    if (this.sink.flush) {
      await this.sink.flush();
    }
  }

  private bumpFrequency(commandName: string): number {
    const frequency = (this.commandFrequency.get(commandName) || 0) + 1;
    this.commandFrequency.set(commandName, frequency);
    return frequency;
  }

  private emit(event: TelemetryEvent): void {
    try {
      this.sink.emit(event);
    } catch (err) {
      // Intentional console.error: Logger depends on TelemetryTracker,
      // so using Logger here would create a circular dependency.
      console.error("Telemetry emit failed", err);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Console telemetry sink (for development/debugging).
 * Logs important events to console.
 */
export class ConsoleTelemetrySink implements TelemetrySink {
  private silent: boolean;

  constructor(silent: boolean = false) {
    this.silent = silent;
  }

  emit(event: TelemetryEvent): void {
    if (this.silent) {
      return;
    }

    // Only log signal events, not per-command completion noise
    const importantKinds: TelemetryEventKind[] = [
      TELEMETRY_EVENT_KINDS.COMMAND_STARTED,
      TELEMETRY_EVENT_KINDS.COMMAND_FAILED,
    ];

    if (importantKinds.includes(event.kind)) {
      // Intentional console.log: this sink IS the output destination;
      // routing through Logger would create a circular dependency.
      console.log(`[TELEMETRY:${event.kind}]`, event.payload);
    }
  }

  async flush(): Promise<void> {
    // No-op for console sink
  }
}
