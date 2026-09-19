import * as Data from "effect/Data";

export class NotSignedInError extends Data.TaggedError("NotSignedInError") {}

export class SupabaseError extends Data.TaggedError("SupabaseError")<{
  message: string;
  code?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}

export type MutationError = NotSignedInError | SupabaseError | ValidationError;

export function mutationMessage(error: MutationError): string {
  switch (error._tag) {
    case "NotSignedInError":
      return "Not signed in.";
    case "SupabaseError":
    case "ValidationError":
      return error.message;
    default: {
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}
