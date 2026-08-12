"use client";

import Link from "next/link";
import { useRef } from "react";

import { GLOBAL_ADD_OPTIONS } from "@/lib/ui/destinations";
import { PlusIcon } from "@/ui/icons/app-icons";

export function GlobalAddSheet() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className="app-shell__add"
        aria-label="Add something"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        ref={triggerRef}
      >
        <PlusIcon />
        <span className="app-shell__add-label">Add something</span>
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="global-add-title"
        aria-describedby="global-add-description"
        onClose={() => triggerRef.current?.focus()}
      >
        <div className="u-stack">
          <div className="u-stack u-stack--sm">
            <h2 id="global-add-title">Add something</h2>
            <p id="global-add-description">
              It lands in the right place for both of you.
            </p>
          </div>

          <ul className="sheet-option-list">
            {GLOBAL_ADD_OPTIONS.map((option) => (
              <li key={option.id}>
                <Link
                  href={option.href}
                  className="sheet-option"
                  onClick={close}
                >
                  <strong>{option.label}</strong>
                  <p>{option.description}</p>
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="button button--secondary"
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
