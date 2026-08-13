"use client";

import Link, { useLinkStatus } from "next/link";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

const PENDING_DELAY_MS = 100;

export function useSlowLinkStatus(): boolean {
  const { pending } = useLinkStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setSlow(true);
    }, PENDING_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);

  return slow;
}

function SlowLinkStatus({
  children,
  onPendingChange,
}: {
  children: (pending: boolean) => ReactNode;
  onPendingChange: (pending: boolean) => void;
}) {
  const pending = useSlowLinkStatus();

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  return children(pending);
}

export function SlowLink({
  children,
  className,
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & {
  children: (pending: boolean) => ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Link
      {...props}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={className}
      href={href}
    >
      <SlowLinkStatus onPendingChange={setPending}>{children}</SlowLinkStatus>
    </Link>
  );
}
