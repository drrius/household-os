import { Data, Duration, Effect, Schedule } from "effect";

/**
 * Effect-based client for the Household OS bridge API. The worker holds no
 * domain logic of its own: it lists tools from the app's manifest and relays
 * calls, authenticated by the member's grant token.
 */

export class BridgeError extends Data.TaggedError("BridgeError")<{
  message: string;
  status: number | null;
  retryable: boolean;
}> {}

export type ToolManifestEntry = {
  name: string;
  description: string;
  kind: "read" | "write" | "financial";
  inputSchema: Record<string, unknown>;
};

type BridgeRequest = {
  appUrl: string;
  grantToken: string;
  path: string;
  body?: unknown;
};

const request = ({ appUrl, grantToken, path, body }: BridgeRequest) =>
  Effect.tryPromise({
    try: (signal) =>
      fetch(new URL(path, appUrl), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${grantToken}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      }),
    catch: (cause) =>
      new BridgeError({
        message: `Household OS is unreachable: ${String(cause)}`,
        status: null,
        retryable: true,
      }),
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json() as Promise<Record<string, unknown>>,
        catch: () =>
          new BridgeError({
            message: `Household OS returned a malformed response (${response.status})`,
            status: response.status,
            retryable: false,
          }),
      }).pipe(
        Effect.flatMap((payload) => {
          if (response.ok) {
            return Effect.succeed(payload);
          }
          const message =
            typeof payload.error === "string"
              ? payload.error
              : `Household OS rejected the request (${response.status})`;
          return Effect.fail(
            new BridgeError({
              message,
              status: response.status,
              retryable: response.status >= 500,
            }),
          );
        }),
      ),
    ),
    Effect.timeoutFail({
      duration: Duration.seconds(30),
      onTimeout: () =>
        new BridgeError({
          message: "Household OS timed out",
          status: null,
          retryable: true,
        }),
    }),
    Effect.retry({
      schedule: Schedule.exponential(Duration.millis(300)),
      times: 1,
      while: (error) => error.retryable,
    }),
  );

export function fetchToolManifest(
  appUrl: string,
  grantToken: string,
): Promise<readonly ToolManifestEntry[]> {
  return Effect.runPromise(
    request({ appUrl, grantToken, path: "/api/mcp/tools" }).pipe(
      Effect.map((payload) => payload.tools as ToolManifestEntry[]),
    ),
  );
}

export type ToolCallOutcome =
  { ok: true; result: unknown } | { ok: false; message: string };

export function callBridgeTool(options: {
  appUrl: string;
  grantToken: string;
  tool: string;
  input: unknown;
  idempotencyKey: string;
}): Promise<ToolCallOutcome> {
  const effect = request({
    appUrl: options.appUrl,
    grantToken: options.grantToken,
    path: "/api/mcp/call",
    body: {
      tool: options.tool,
      input: options.input,
      idempotencyKey: options.idempotencyKey,
    },
  }).pipe(
    Effect.map((payload): ToolCallOutcome => ({
      ok: true,
      result: payload.result,
    })),
    Effect.catchTag("BridgeError", (error) =>
      Effect.succeed<ToolCallOutcome>({ ok: false, message: error.message }),
    ),
  );
  return Effect.runPromise(effect);
}
