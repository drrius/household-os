const RETURN_ORIGIN = "https://household.invalid";
const MEMBER_DESTINATION =
  /^(?:\/(?:plan|groceries|money|home)(?:\/|$)|\/(?:security|search)\/?$|\/$)/u;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/u;

/** Only product pages can be a post-authentication destination. Never APIs or auth routes. */
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    value !== value.trim()
  )
    return "/";
  try {
    let decodedPath = value.split(/[?#]/u, 1)[0] ?? "";
    for (let depth = 0; depth < 5; depth++) {
      if (
        !decodedPath.startsWith("/") ||
        decodedPath.startsWith("//") ||
        CONTROL_OR_BACKSLASH.test(decodedPath)
      )
        return "/";
      const normalized = new URL(decodedPath, RETURN_ORIGIN);
      if (
        normalized.origin !== RETURN_ORIGIN ||
        !MEMBER_DESTINATION.test(normalized.pathname)
      )
        return "/";
      const next = decodeURIComponent(decodedPath);
      if (next === decodedPath) break;
      if (depth === 4) return "/";
      decodedPath = next;
    }
    if (
      CONTROL_OR_BACKSLASH.test(value) ||
      /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/iu.test(value)
    )
      return "/";
    const url = new URL(value, RETURN_ORIGIN);
    if (url.origin !== RETURN_ORIGIN || !MEMBER_DESTINATION.test(url.pathname))
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** HTTP requests omit fragments; browsers can inherit one across the sign-in redirect. */
export function returnPathWithFragment(
  value: unknown,
  fragment: string,
): string {
  const path = safeReturnPath(value);
  return path.includes("#") || !fragment.startsWith("#")
    ? path
    : safeReturnPath(`${path}${fragment}`);
}
