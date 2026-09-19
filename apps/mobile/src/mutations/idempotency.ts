import { randomUUID } from "expo-crypto";

export function newIdempotencyKey(): string {
  return randomUUID();
}
