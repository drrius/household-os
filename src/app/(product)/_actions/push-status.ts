"use server";

import {
  PushStatusError,
  devicePushTest,
  readPushRegistration,
} from "@/lib/notifications/push-status";
import type {
  PushStatusResult,
  PushTestStatus,
} from "@/lib/notifications/push-status-contract";

export async function readPushRegistrationAction(
  endpoint: string,
): Promise<PushStatusResult<{ registered: boolean }>> {
  try {
    return { ok: true, value: await readPushRegistration(endpoint) };
  } catch {
    return {
      ok: false,
      error:
        "Could not check this device. Check your connection and try again.",
    };
  }
}

async function runTestCommand(
  command: "enqueue_self_device_push_test" | "read_self_device_push_test",
  input: { endpoint: string; requestId: string },
): Promise<PushStatusResult<PushTestStatus>> {
  try {
    return { ok: true, value: await devicePushTest(command, input) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof PushStatusError
          ? error.message
          : "Could not check the test. Try again.",
    };
  }
}

export async function enqueueDevicePushTestAction(input: {
  endpoint: string;
  requestId: string;
}) {
  return runTestCommand("enqueue_self_device_push_test", input);
}
export async function readDevicePushTestAction(input: {
  endpoint: string;
  requestId: string;
}) {
  return runTestCommand("read_self_device_push_test", input);
}
