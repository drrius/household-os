"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStarterOperation } from "./use-starter-operation.client";
import type { ProjectKind } from "@/domain/projects/types";
import { startersFor } from "@/domain/projects/starters";
import {
  addStarterTasksAction,
  type StarterResult,
} from "@/lib/projects/starter-action";
import { Button, buttonVariants } from "@/components/ui/button";

export function StarterChecklists({
  projectId,
  kind,
  action = addStarterTasksAction,
}: {
  projectId: string;
  kind: ProjectKind;
  action?: (previous: StarterResult, form: FormData) => Promise<StarterResult>;
}) {
  const choices = startersFor(kind);
  const operation = useStarterOperation(projectId);
  const [preset, setPreset] = useState(choices[0]!.key as string);
  const starter = choices.find((item) => item.key === preset)!;
  const [selected, setSelected] = useState<string[]>(
    starter.tasks.map((item) => item[0]),
  );
  const { submission, submit, pending, result, errorRef } =
    useStarterSubmission(async (previous, form) => {
      const next = await action(previous, form);
      if (next && "added" in next) operation.confirm();
      return next;
    });
  if (result && "added" in result)
    return (
      <StarterSuccess
        result={result}
        projectId={projectId}
        error={operation.error}
      />
    );
  return (
    <form key={submission.submissionId} action={submit} className="grid gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="operationId" value={operation.id ?? ""} />
      {operation.error ? <p role="alert">{operation.error}</p> : null}
      <fieldset
        disabled={pending || operation.id === null}
        className="grid gap-5"
      >
        <StarterPreset
          choices={choices}
          preset={preset}
          onSelect={(next) => {
            setPreset(next.key);
            setSelected(next.tasks.map((item) => item[0]));
          }}
        />
        <StarterChoices
          starter={starter}
          selected={selected}
          onToggle={(key, checked) =>
            setSelected((current) =>
              checked
                ? [...current, key]
                : current.filter((item) => item !== key),
            )
          }
        />
        <p className="text-sm text-muted-foreground">
          Choose what helps. You can assign, edit or remove tasks afterward.
          Tasks already on this checklist are skipped, including completed ones.
        </p>
        <Button
          type="submit"
          disabled={pending || operation.id === null || selected.length === 0}
        >
          {pending
            ? "Adding tasks…"
            : `Add ${selected.length} ${selected.length === 1 ? "task" : "tasks"}`}
        </Button>
      </fieldset>
      <StarterFailure result={result} errorRef={errorRef} />
    </form>
  );
}

function StarterFailure({
  result,
  errorRef,
}: {
  result: StarterResult;
  errorRef: RefObject<HTMLParagraphElement | null>;
}) {
  return result && "error" in result ? (
    <p ref={errorRef} tabIndex={-1} role="alert" className="text-destructive">
      {result.error}
    </p>
  ) : null;
}

function StarterSuccess({
  result,
  projectId,
  error,
}: {
  error: string | null;
  result: { added: number; skipped: number };
  projectId: string;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-5">
      {error ? <p role="alert">{error}</p> : null}
      <p role="status">
        {result.added} {result.added === 1 ? "task added" : "tasks added"}.
        {result.skipped > 0 ? ` ${result.skipped} already present.` : ""}
      </p>
      <Link
        className={buttonVariants()}
        href={`/plan/projects/${projectId}#tasks`}
      >
        Open checklist
      </Link>
    </div>
  );
}

function StarterChoices({
  starter,
  selected,
  onToggle,
}: {
  starter: ReturnType<typeof startersFor>[number];
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border bg-card p-3">
      {starter.tasks.map(([key, title]) => (
        <label
          key={key}
          className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-muted"
        >
          <input
            type="checkbox"
            name="item"
            value={key}
            checked={selected.includes(key)}
            className="mt-1 size-5 shrink-0 accent-primary"
            onChange={(event) => onToggle(key, event.target.checked)}
          />
          <span>{title}</span>
        </label>
      ))}
    </div>
  );
}

function useStarterSubmission(
  action: (previous: StarterResult, form: FormData) => Promise<StarterResult>,
) {
  const [submission, submit, pending] = useActionState(
    async (
      previous: { result: StarterResult; submissionId: number },
      form: FormData,
    ) => ({
      result: await action(previous.result, form),
      submissionId: previous.submissionId + 1,
    }),
    { result: null, submissionId: 0 },
  );
  const { result } = submission;
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (result && "error" in result) errorRef.current?.focus();
  }, [result]);
  return { submission, submit, pending, result, errorRef };
}

function StarterPreset({
  choices,
  preset,
  onSelect,
}: {
  choices: ReturnType<typeof startersFor>;
  preset: string;
  onSelect: (starter: ReturnType<typeof startersFor>[number]) => void;
}) {
  return (
    <label className="grid gap-2 font-medium">
      Start with
      <select
        name="preset"
        value={preset}
        className="min-h-11 rounded-xl border bg-background px-3 text-base"
        onChange={(event) => {
          const next = choices.find((item) => item.key === event.target.value);
          if (next) onSelect(next);
        }}
      >
        {choices.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
