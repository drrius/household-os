import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  getMcpEnv,
  isRedirectUriAllowed,
  signAuthorizationCode,
} from "@/lib/mcp/tokens";

type AuthorizeSearchParams = {
  redirect_uri?: string;
  state?: string;
  client_name?: string;
};

function invalidRequest(message: string) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-xl font-bold">Connection request</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
    </main>
  );
}

/**
 * Consent screen for connecting an external AI via the MCP worker. The
 * member signs in with their passkey as usual (this page is member-gated by
 * the proxy), reviews what access means, and approving redirects back to
 * the worker with a short-lived, single-purpose authorization code.
 */
export default async function AuthorizeConnectionPage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeSearchParams>;
}) {
  const member = await requireMemberContext();
  const { redirect_uri, state, client_name } = await searchParams;
  const env = getMcpEnv();

  if (env === null) {
    return invalidRequest("The MCP bridge is not configured for this app.");
  }
  if (
    redirect_uri === undefined ||
    state === undefined ||
    !isRedirectUriAllowed(env, redirect_uri)
  ) {
    return invalidRequest(
      "This connection request is malformed or comes from an unknown origin.",
    );
  }

  const clientLabel =
    client_name !== undefined && client_name.length > 0
      ? client_name
      : "An external AI client";

  async function approve() {
    "use server";
    const actionMember = await requireMemberContext();
    const actionEnv = getMcpEnv();
    if (
      actionEnv === null ||
      redirect_uri === undefined ||
      state === undefined ||
      !isRedirectUriAllowed(actionEnv, redirect_uri)
    ) {
      throw new Error("Connection request is no longer valid");
    }
    const code = await signAuthorizationCode(actionEnv, {
      userId: actionMember.userId,
      email: actionMember.email,
      displayName: actionMember.displayName,
    });
    const target = new URL(redirect_uri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", state);
    redirect(target.toString());
  }

  const denyUrl = new URL(redirect_uri);
  denyUrl.searchParams.set("error", "access_denied");
  denyUrl.searchParams.set("state", state);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-xl font-bold">Connect {clientLabel}?</h1>
      <p className="mt-3 text-muted-foreground">
        It will act in Household OS as {member.displayName}: reading and
        managing routines, groceries, meals, and money — including recording
        financial events. Every action is written to the shared history under
        your name.
      </p>
      <form action={approve} className="mt-6 grid gap-3">
        <Button type="submit">Allow access</Button>
        <Button render={<a href={denyUrl.toString()} />} variant="outline">
          Cancel
        </Button>
      </form>
    </main>
  );
}
