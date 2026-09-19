import { useRef } from "react";
import { newIdempotencyKey } from "./idempotency";

export function useIdempotencyKey() {
  const keyRef = useRef(newIdempotencyKey());
  return {
    current: () => keyRef.current,
    rotate: () => {
      keyRef.current = newIdempotencyKey();
    },
  };
}
