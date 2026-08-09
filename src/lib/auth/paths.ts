export const SIGN_IN_PATH = "/sign-in";
export const ACCESS_DENIED_PATH = "/access-denied";
export const AUTH_ERROR_PATH = "/auth/error";
export const AUTH_CONSUME_PATH = "/auth/consume";
export const SECURITY_PATH = "/security";

const PUBLIC_PATHS = new Set([
  SIGN_IN_PATH,
  ACCESS_DENIED_PATH,
  AUTH_ERROR_PATH,
  AUTH_CONSUME_PATH,
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function classifyPath(pathname: string): "public" | "member" {
  return isPublicPath(pathname) ? "public" : "member";
}
