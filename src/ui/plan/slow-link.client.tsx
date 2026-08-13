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

function SlowLinkPending({
  children,
}: {
  children: (pending: boolean) => ReactNode;
}) {
  return children(useSlowLinkStatus());
}

export function SlowLink({
  children,
  className,
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & {
  children: (pending: boolean) => ReactNode;
}) {
  return (
    <Link className={className} href={href} {...props}>
      <SlowLinkPending>{children}</SlowLinkPending>
    </Link>
  );
}
