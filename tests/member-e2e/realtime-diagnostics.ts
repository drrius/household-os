import type { Page } from "@playwright/test";

function errorCategories(value: unknown) {
  const message = typeof value === "string" ? value.toLowerCase() : "";
  return [
    "token",
    "authorization",
    "permission",
    "publication",
    "table",
    "column",
    "timeout",
    "limit",
    "subscription",
  ].filter((category) => message.includes(category));
}

// Log protocol metadata only: socket URLs, auth tokens and row values stay private.
export function watchRealtime(page: Page, member: string) {
  page.on("pageerror", (error) => {
    console.info(`${member} browser error type:`, error.name);
  });
  page.on("websocket", (socket) => {
    if (!new URL(socket.url()).pathname.startsWith("/realtime/")) return;
    console.info(`${member} realtime socket created`);
    socket.on("socketerror", () =>
      console.info(`${member} realtime socket error`),
    );
    socket.on("close", () => console.info(`${member} realtime socket closed`));
    socket.on("framereceived", ({ payload }) => {
      try {
        const decoded = JSON.parse(String(payload));
        const frame = Array.isArray(decoded)
          ? { event: decoded[3], payload: decoded[4] }
          : decoded;
        const body = frame.payload;
        if (frame.event === "phx_reply") {
          console.info(`${member} realtime reply:`, {
            status: body?.status === "ok" ? "ok" : "error",
            subscriptions: Array.isArray(body?.response?.postgres_changes)
              ? body.response.postgres_changes.length
              : null,
            errorCategories: errorCategories(body?.response?.reason),
          });
        } else if (frame.event === "system") {
          console.info(`${member} realtime system:`, {
            success: body?.status === "ok",
            errorCategories: errorCategories(body?.message),
          });
        } else if (frame.event === "postgres_changes") {
          console.info(`${member} realtime database change received`);
        }
      } catch {
        console.info(`${member} realtime non-JSON frame`);
      }
    });
  });
}
