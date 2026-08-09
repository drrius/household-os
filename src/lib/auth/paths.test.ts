import { describe, expect, it } from "vitest";

import { classifyPath, isPublicPath } from "./paths";

describe("auth path classification", () => {
  it("marks identity plumbing as public", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/auth/consume")).toBe(true);
    expect(isPublicPath("/auth/error")).toBe(true);
    expect(isPublicPath("/access-denied")).toBe(true);
    expect(classifyPath("/sign-in")).toBe("public");
  });

  it("marks application routes as member-only", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/security")).toBe(false);
    expect(classifyPath("/")).toBe("member");
    expect(classifyPath("/security")).toBe("member");
  });
});
