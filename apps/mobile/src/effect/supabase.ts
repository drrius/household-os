import * as Effect from "effect/Effect";
import { supabase } from "../lib/supabase";
import { SupabaseError } from "./errors";

type PostgrestError = { message: string; code?: string };

function toSupabaseError(error: unknown, fallback: string): SupabaseError {
  if (error !== null && typeof error === "object" && "message" in error) {
    const err = error as PostgrestError;
    return new SupabaseError({
      message: String(err.message),
      code: typeof err.code === "string" ? err.code : undefined,
    });
  }
  return new SupabaseError({ message: fallback });
}

export function rpc<A>(
  name: string,
  args: Record<string, unknown>,
): Effect.Effect<A, SupabaseError> {
  return Effect.tryPromise({
    try: async () => {
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      return data as A;
    },
    catch: (error) => toSupabaseError(error, `${name} failed`),
  });
}

export function query<A>(
  name: string,
  run: () => Promise<A>,
): Effect.Effect<A, SupabaseError> {
  return Effect.tryPromise({
    try: run,
    catch: (error) => toSupabaseError(error, `${name} failed`),
  });
}

export function runMutation<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(effect);
}
