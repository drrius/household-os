import type { Page } from "@playwright/test";

// Log protocol metadata only: socket URLs, auth tokens and row values stay private.
export function watchRealtime(page: Page, member: string) {
  page.on("pageerror", (error) => {
    console.info(`${member} browser error type:`, error.name);
  });
  page.on("websocket", (socket) => {
    if (!new URL(socket.url()).pathname.startsWith("/realtime/")) return;
    console.info(`${member} realtime socket opened`);
    socket.on("close", () => console.info(`${member} realtime socket closed`));
    socket.on("framereceived", ({ payload }) => {
      try {
        const frame = JSON.parse(String(payload));
        const body = frame.payload;
        if (frame.event === "phx_reply") {
          console.info(`${member} realtime reply:`, {
            status: body?.status === "ok" ? "ok" : "error",
            subscriptions: Array.isArray(body?.response?.postgres_changes)
              ? body.response.postgres_changes.length
              : null,
          });
        } else if (frame.event === "system") {
          console.info(`${member} realtime system:`, {
            success: body?.status === "ok",
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
