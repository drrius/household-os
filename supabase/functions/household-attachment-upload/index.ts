import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";
import jpeg from "npm:jpeg-js@0.4.4";
import { inspectAttachment } from "./inspect.ts";
import {
  AttachmentAuthorizationFailure,
  handleAttachmentUpload,
} from "./handler.ts";

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const credential = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publicKey || !credential)
    return Response.json(
      { error: "Uploads are not configured." },
      { status: 503 },
    );
  const user = createClient(url, publicKey, {
    global: {
      headers: { Authorization: request.headers.get("authorization") ?? "" },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleAttachmentUpload(request, {
    inspect: (bytes) => inspectAttachment(bytes, jpeg.decode),
    authorize: async (token) => {
      const { data, error } = await user.auth.getUser(token);
      if (error)
        throw new AttachmentAuthorizationFailure(
          error.status &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
            ? 401
            : 503,
        );
      if (!data.user) throw new AttachmentAuthorizationFailure(401);
      const member = await user
        .from("household_members")
        .select("household_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (member.error)
        throw new AttachmentAuthorizationFailure(
          ["PGRST301", "PGRST302", "PGRST303"].includes(member.error.code)
            ? 401
            : member.error.code === "42501"
              ? 403
              : 503,
        );
      return member.data?.household_id ?? null;
    },
    reserve: async (path, mime) =>
      user.rpc("reserve_household_attachment", {
        p_path: path,
        p_content_type: mime,
      }),
    upload: async (path, bytes, mime) => {
      // This credential is injected by Supabase and never sent to Vercel or the browser.
      // Only this byte-inspected, canonical, reserved object can reach the privileged writer.
      const writer = createClient(url, credential, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return writer.storage
        .from("household-files")
        .upload(path, bytes, { contentType: mime, upsert: false });
    },
  });
});
