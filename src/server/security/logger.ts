import 'server-only';
import { NextResponse } from 'next/server';

export interface LogMetadata {
  requestId: string;
  route: string;
  section?: string;
  provider?: 'jarvis' | 'gemini' | 'template';
  attempts?: number;
  valid?: boolean;
  latencyMs?: number;
  status: number | 'ok' | 'error' | 'warn';
  message?: string;
  extra?: Record<string, unknown>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

/**
 * Structured security-conscious logger.
 * INVARIANT: NEVER logs prompts, user notes, raw responses, or key material.
 */
export class StructuredLogger {
  private format(level: 'INFO' | 'WARN' | 'ERROR', meta: LogMetadata): string {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...meta,
    };
    return JSON.stringify(entry);
  }

  info(meta: LogMetadata): void {
    console.log(this.format('INFO', meta));
  }

  warn(meta: LogMetadata): void {
    console.warn(this.format('WARN', meta));
  }

  error(meta: LogMetadata): void {
    console.error(this.format('ERROR', meta));
  }
}

export const logger = new StructuredLogger();

/**
 * Creates standardized, sanitised JSON error responses without stack traces or provider internals.
 */
export function createErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  headers?: Record<string, string>,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {}),
    },
  };

  return NextResponse.json(body, {
    status,
    headers: {
      'x-request-id': requestId,
      ...(headers || {}),
    },
  });
}
