"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { GLOBAL_ADD_OPTIONS } from "@/lib/ui/destinations";
import { PlusIcon } from "@/ui/icons/app-icons";

export function GlobalAddSheet() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="app-shell__add"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        <span className="app-shell__add-label">Add something</span>
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="u-stack">
          <div className="u-stack u-stack--sm">
            <h2 id={titleId}>Add something</h2>
            <p id={descriptionId}>
              It lands in the right place for both of you.
            </p>
          </div>

          <ul className="sheet-option-list">
            {GLOBAL_ADD_OPTIONS.map((option) => (
              <li key={option.id}>
                <Link
                  href={option.href}
                  className="sheet-option"
                  onClick={() => setOpen(false)}
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
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
