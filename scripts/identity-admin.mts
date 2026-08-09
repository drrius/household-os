import {
  createSupabaseIdentityAdminGateway,
  runIdentityAdmin,
} from "./lib/identity-admin.ts";

async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  process.stdin.setEncoding("utf8");

  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }

  return chunks.join("");
}

try {
  await runIdentityAdmin(process.argv.slice(2), {
    createGateway: createSupabaseIdentityAdminGateway,
    readSecret: readStdin,
    writeLine(line) {
      process.stdout.write(`${line}\n`);
    },
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`identity-admin: ${message}\n`);
  process.exitCode = 1;
}
