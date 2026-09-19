export function shouldUseMockSession(): boolean {
  const flag = process.env.EXPO_PUBLIC_USE_MOCK;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return typeof __DEV__ !== "undefined" && __DEV__;
}
