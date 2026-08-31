import "server-only";

export type AiWriteContext = {
  /** Stable per logical tool call, so retries dedupe in the database. */
  idempotencyKey: string;
  /** Today's civil date in Europe/Zurich. */
  today: string;
};

export type AiWriteResult = Record<string, unknown> | { done: true };

export type AiWriteHandler = (
  input: unknown,
  context: AiWriteContext,
) => Promise<AiWriteResult>;
