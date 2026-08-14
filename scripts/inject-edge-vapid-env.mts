import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EDGE_CONTAINER = "supabase_edge_runtime_household-os";
const FUNCTIONS_ENV_PATH = resolve(process.cwd(), "supabase/functions/.env");
const FUNCTIONS_CONFIG_ENV = "SUPABASE_INTERNAL_FUNCTIONS_CONFIG";
const PUSH_DISPATCH = "push-dispatch";
const VAPID_PUBLIC_KEY = "VAPID_PUBLIC_KEY";
const VAPID_PRIVATE_KEY = "VAPID_PRIVATE_KEY";
const PUSH_DISPATCH_URL = "http://127.0.0.1:54321/functions/v1/push-dispatch";
const READY_TIMEOUT_MS = 15_000;
const READY_POLL_MS = 250;

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

type DockerInspect = {
  Config: {
    Image: string;
    Env: string[];
    Cmd: string[] | null;
    Entrypoint: string[] | null;
    WorkingDir: string;
    Labels: Record<string, string> | null;
    User: string;
  };
  HostConfig: {
    Binds: string[] | null;
    NetworkMode: string;
  };
};

function runDocker(args: string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function requireDocker(args: string[], failureMessage: string): string {
  const result = runDocker(args);
  if (result.status !== 0) {
    throw new Error(
      `${failureMessage}: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout;
}

function readVapidKeys(): VapidKeys {
  if (!existsSync(FUNCTIONS_ENV_PATH)) {
    throw new Error(`missing ${FUNCTIONS_ENV_PATH}`);
  }

  const values = new Map<string, string>();
  for (const line of readFileSync(FUNCTIONS_ENV_PATH, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }

  const publicKey = values.get(VAPID_PUBLIC_KEY);
  const privateKey = values.get(VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) {
    throw new Error(
      `${FUNCTIONS_ENV_PATH} must define VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY`,
    );
  }
  return { publicKey, privateKey };
}

function findRunningEdgeContainer(): string | null {
  const named = runDocker([
    "ps",
    "--filter",
    `name=${EDGE_CONTAINER}`,
    "--format",
    "{{.Names}}",
  ]);
  if (named.status === 0) {
    const names = named.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (names.includes(EDGE_CONTAINER)) {
      return EDGE_CONTAINER;
    }
  }

  const listed = runDocker(["ps", "--format", "{{.Names}}\t{{.Image}}"]);
  if (listed.status !== 0) {
    return null;
  }
  for (const line of listed.stdout.split(/\r?\n/u)) {
    const [name = "", image = ""] = line.split("\t");
    if (
      name.includes("edge_runtime") &&
      name.includes("household-os") &&
      image.includes("edge-runtime")
    ) {
      return name;
    }
  }
  return null;
}

function envListToMap(entries: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    map.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  return map;
}

function mapToEnvList(map: Map<string, string>): string[] {
  return [...map.entries()].map(([key, value]) => `${key}=${value}`);
}

function readPushDispatchEnv(
  functionsConfigJson: string | undefined,
): Record<string, string> | null {
  if (!functionsConfigJson) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(functionsConfigJson);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const pushDispatch = Reflect.get(parsed, PUSH_DISPATCH);
  if (
    typeof pushDispatch !== "object" ||
    pushDispatch === null ||
    Array.isArray(pushDispatch)
  ) {
    return null;
  }

  const env = Reflect.get(pushDispatch, "env");
  if (typeof env !== "object" || env === null || Array.isArray(env)) {
    return null;
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

function vapidAlreadyInjected(envList: string[], keys: VapidKeys): boolean {
  const env = envListToMap(envList);
  if (
    env.get(VAPID_PUBLIC_KEY) !== keys.publicKey ||
    env.get(VAPID_PRIVATE_KEY) !== keys.privateKey
  ) {
    return false;
  }

  const pushEnv = readPushDispatchEnv(env.get(FUNCTIONS_CONFIG_ENV));
  return (
    pushEnv !== null &&
    env.get(FUNCTIONS_CONFIG_ENV)?.includes('"verifyJWT":false') === true &&
    pushEnv[VAPID_PUBLIC_KEY] === keys.publicKey &&
    pushEnv[VAPID_PRIVATE_KEY] === keys.privateKey
  );
}

function injectVapidIntoFunctionsConfig(
  functionsConfigJson: string | undefined,
  keys: VapidKeys,
): string {
  let root: Record<string, unknown> = {};
  if (functionsConfigJson) {
    const parsed: unknown = JSON.parse(functionsConfigJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      root = { ...parsed };
    }
  }

  const existingFn = Reflect.get(root, PUSH_DISPATCH);
  const fnConfig: Record<string, unknown> =
    typeof existingFn === "object" &&
    existingFn !== null &&
    !Array.isArray(existingFn)
      ? { ...existingFn }
      : {
          verifyJWT: false,
          entrypointPath: "supabase/functions/push-dispatch/index.ts",
        };

  const existingEnv = Reflect.get(fnConfig, "env");
  const env: Record<string, unknown> =
    typeof existingEnv === "object" &&
    existingEnv !== null &&
    !Array.isArray(existingEnv)
      ? { ...existingEnv }
      : {};

  env[VAPID_PUBLIC_KEY] = keys.publicKey;
  env[VAPID_PRIVATE_KEY] = keys.privateKey;
  fnConfig.verifyJWT = false;
  fnConfig.env = env;
  root[PUSH_DISPATCH] = fnConfig;
  return JSON.stringify(root);
}

function buildEnvWithVapid(envList: string[], keys: VapidKeys): string[] {
  const env = envListToMap(envList);
  env.set(VAPID_PUBLIC_KEY, keys.publicKey);
  env.set(VAPID_PRIVATE_KEY, keys.privateKey);
  env.set(
    FUNCTIONS_CONFIG_ENV,
    injectVapidIntoFunctionsConfig(env.get(FUNCTIONS_CONFIG_ENV), keys),
  );
  return mapToEnvList(env);
}

function inspectContainer(name: string): DockerInspect {
  const stdout = requireDocker(
    ["inspect", name],
    `docker inspect failed for ${name}`,
  );
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`docker inspect returned no container for ${name}`);
  }

  const first = parsed[0];
  if (typeof first !== "object" || first === null) {
    throw new Error(`docker inspect returned invalid payload for ${name}`);
  }

  const config = Reflect.get(first, "Config");
  const hostConfig = Reflect.get(first, "HostConfig");
  if (
    typeof config !== "object" ||
    config === null ||
    typeof hostConfig !== "object" ||
    hostConfig === null
  ) {
    throw new Error(`docker inspect missing Config/HostConfig for ${name}`);
  }

  const image = Reflect.get(config, "Image");
  if (typeof image !== "string" || image.length === 0) {
    throw new Error(`docker inspect missing image for ${name}`);
  }

  const env = Reflect.get(config, "Env");
  const labels = Reflect.get(config, "Labels");
  const workingDir = Reflect.get(config, "WorkingDir");
  const entrypoint = Reflect.get(config, "Entrypoint");
  const cmd = Reflect.get(config, "Cmd");
  const user = Reflect.get(config, "User");
  const binds = Reflect.get(hostConfig, "Binds");
  const networkMode = Reflect.get(hostConfig, "NetworkMode");

  return {
    Config: {
      Image: image,
      Env: Array.isArray(env)
        ? env.filter((entry): entry is string => typeof entry === "string")
        : [],
      Labels:
        typeof labels === "object" && labels !== null && !Array.isArray(labels)
          ? Object.fromEntries(
              Object.entries(labels).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === "string",
              ),
            )
          : null,
      WorkingDir: typeof workingDir === "string" ? workingDir : "",
      Entrypoint: Array.isArray(entrypoint)
        ? entrypoint.filter((part): part is string => typeof part === "string")
        : null,
      Cmd: Array.isArray(cmd)
        ? cmd.filter((part): part is string => typeof part === "string")
        : null,
      User: typeof user === "string" ? user : "",
    },
    HostConfig: {
      Binds: Array.isArray(binds)
        ? binds.filter((bind): bind is string => typeof bind === "string")
        : null,
      NetworkMode: typeof networkMode === "string" ? networkMode : "",
    },
  };
}

function recreateWithVapid(
  name: string,
  inspect: DockerInspect,
  keys: VapidKeys,
): void {
  const envList = buildEnvWithVapid(inspect.Config.Env, keys);
  const createArgs = ["create", `--name=${name}`];

  if (inspect.HostConfig.NetworkMode) {
    createArgs.push(`--network=${inspect.HostConfig.NetworkMode}`);
  }
  for (const bind of inspect.HostConfig.Binds ?? []) {
    createArgs.push("--volume", bind);
  }
  for (const [label, value] of Object.entries(inspect.Config.Labels ?? {})) {
    createArgs.push("--label", `${label}=${value}`);
  }
  if (inspect.Config.WorkingDir) {
    createArgs.push("--workdir", inspect.Config.WorkingDir);
  }
  if (inspect.Config.User) {
    createArgs.push("--user", inspect.Config.User);
  }
  for (const entry of envList) {
    createArgs.push("--env", entry);
  }

  const entrypoint = inspect.Config.Entrypoint;
  if (entrypoint !== null && entrypoint.length > 0) {
    createArgs.push("--entrypoint", entrypoint[0]);
  }

  createArgs.push(inspect.Config.Image);

  if (entrypoint !== null && entrypoint.length > 1) {
    createArgs.push(...entrypoint.slice(1));
  }
  if (inspect.Config.Cmd !== null) {
    createArgs.push(...inspect.Config.Cmd);
  }

  runDocker(["stop", name]);
  const removed = runDocker(["rm", "-f", name]);
  if (removed.status !== 0) {
    const detail = `${removed.stderr} ${removed.stdout}`;
    if (!/No such container/iu.test(detail)) {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const stillThere = runDocker(["inspect", name]);
        if (stillThere.status !== 0) {
          break;
        }
        spawnSync("sleep", ["0.25"]);
      }
      const gone = runDocker(["inspect", name]);
      if (gone.status === 0) {
        throw new Error(`failed to remove ${name}: ${detail.trim()}`);
      }
    }
  }
  requireDocker(createArgs, `failed to create ${name}`);
  requireDocker(["start", name], `failed to start ${name}`);
}

async function waitForPushDispatch(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = "no response";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(PUSH_DISPATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      void response.status;
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolveWait) =>
        setTimeout(resolveWait, READY_POLL_MS),
      );
    }
  }

  throw new Error(`push-dispatch not reachable: ${lastError}`);
}

async function main(): Promise<void> {
  const keys = readVapidKeys();
  const containerName = findRunningEdgeContainer();
  if (containerName === null) {
    process.stderr.write(
      "inject-edge-vapid-env: edge runtime not running; skip\n",
    );
    return;
  }

  const inspect = inspectContainer(containerName);
  if (vapidAlreadyInjected(inspect.Config.Env, keys)) {
    return;
  }

  recreateWithVapid(containerName, inspect, keys);
  await waitForPushDispatch();
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`inject-edge-vapid-env: ${message}\n`);
  process.exitCode = 1;
}
