"use client";
import { useRef, useState } from "react";
import { QuickAdd } from "@/ui/groceries/quick-add.client";
export function QuickAddFixture() {
  const finish = useRef<((failure: boolean) => void) | null>(null);
  const [saved, setSaved] = useState("");
  async function add(form: FormData) {
    await new Promise<void>((resolve, reject) => {
      finish.current = (failure) => {
        if (failure) reject(new Error("Could not add this item. Try again."));
        else {
          setSaved(String(form.get("name")));
          resolve();
        }
      };
    });
  }
  return (
    <main className="grid gap-4 p-4">
      <QuickAdd action={add} />
      <>
        <button onClick={() => finish.current?.(true)}>
          Fail pending request
        </button>
        <button onClick={() => finish.current?.(false)}>
          Complete pending request
        </button>
      </>
      {saved && <p>Saved {saved}</p>}
    </main>
  );
}
