export const SIGN_IN_PATH = "/sign-in";
export const ACCESS_DENIED_PATH = "/access-denied";
export const AUTH_ERROR_PATH = "/auth/error";
export const AUTH_CONSUME_PATH = "/auth/consume";
export const SECURITY_PATH = "/security";
export const SERVICE_WORKER_PATH = "/household-os-sw.js";
export const WEB_APP_MANIFEST_PATH = "/manifest.webmanifest";

// The MCP bridge cannot present a cookie session; every route under this
// prefix authenticates its own signed bearer grant instead.
export const MCP_API_PREFIX = "/api/mcp/";

const PUBLIC_PATHS = new Set([
  SIGN_IN_PATH,
  ACCESS_DENIED_PATH,
  AUTH_ERROR_PATH,
  AUTH_CONSUME_PATH,
  SERVICE_WORKER_PATH,
  WEB_APP_MANIFEST_PATH,
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith(MCP_API_PREFIX);
}

export function classifyPath(pathname: string): "public" | "member" {
  return isPublicPath(pathname) ? "public" : "member";
}
