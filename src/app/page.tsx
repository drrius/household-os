import Link from "next/link";

import { requireMemberContext } from "@/lib/auth/member-context";
import { SECURITY_PATH } from "@/lib/auth/paths";

export default async function HomePage() {
  const member = await requireMemberContext();

  return (
    <main>
      <h1>Household OS</h1>
      <p>Signed in as {member.displayName}.</p>
      <p>
        The product foundation is ready. Visual design is intentionally pending.
      </p>
      <p>
        <Link href={SECURITY_PATH}>Security</Link>
      </p>
    </main>
  );
}
