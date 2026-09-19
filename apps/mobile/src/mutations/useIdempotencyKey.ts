import { useRef } from "react";
import { newIdempotencyKey } from "./idempotency";

export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);
  if (keyRef.current === null) {
    keyRef.current = newIdempotencyKey();
  }
  return {
    current: () => keyRef.current!,
    rotate: () => {
      keyRef.current = newIdempotencyKey();
    },
  };
}
