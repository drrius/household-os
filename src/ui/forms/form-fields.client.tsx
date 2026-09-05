"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";
import { useDiscardGuard } from "./use-discard-guard.client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  initialFormActionState,
  type FormAction,
} from "@/lib/forms/action-state";

type FieldMap = Readonly<Record<string, string>>;

export type FormFieldsState = {
  errors: FieldMap;
  values: FieldMap;
  submissionId: number;
};

const outsideForm: FormFieldsState = {
  errors: {},
  values: {},
  submissionId: 0,
};

const FormFieldsContext = createContext<FormFieldsState>(outsideForm);

export function useFormFieldsState(): FormFieldsState {
  return useContext(FormFieldsContext);
}

export function useFormFieldValue(name: string, initial = ""): string {
  const { values } = useFormFieldsState();
  return values[name] ?? initial;
}

function controlName(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const name = target.getAttribute("name");
  return name === null || name.length === 0 ? null : name;
}

function controlValidationMessage(target: EventTarget | null): string {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.validationMessage;
  }
  return "";
}

function useNativeValidation() {
  const [errors, setErrors] = useState<FieldMap>({});
  const reportingRef = useRef(false);

  const onInvalidCapture = useCallback((event: FormEvent) => {
    const name = controlName(event.target);
    if (name === null) return;
    const message =
      controlValidationMessage(event.target) || "Check this field.";
    if (reportingRef.current) {
      setErrors((current) => ({ ...current, [name]: message }));
      return;
    }
    // The browser reports every invalid control in one synchronous pass, so the
    // first report of a pass replaces whatever the previous attempt left behind.
    reportingRef.current = true;
    queueMicrotask(() => {
      reportingRef.current = false;
    });
    setErrors({ [name]: message });
  }, []);

  const onInput = useCallback((event: FormEvent) => {
    const name = controlName(event.target);
    if (name === null) return;
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  return { errors, onInput, onInvalidCapture };
}

function FormRejectionLiveRegion({
  error,
  liveRegionRef,
}: {
  error: string | undefined;
  liveRegionRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-live="polite"
      className="grid gap-5"
      ref={liveRegionRef}
      tabIndex={-1}
    >
      {error === undefined ? null : (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">
        Everything is required unless marked optional.
      </p>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function FormFields({
  action,
  children,
  submitLabel,
  protectChanges = false,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  protectChanges?: boolean;
}) {
  const {
    errors: nativeErrors,
    onInput,
    onInvalidCapture,
  } = useNativeValidation();
  const [submission, submit, pending] = useActionState(
    action,
    initialFormActionState,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useDiscardGuard(formRef, protectChanges, submission, pending);
  const { error, field, submissionId, values } = submission;

  useEffect(() => {
    if (error !== undefined) alertRef.current?.focus();
  }, [error, submissionId]);

  const state = useMemo<FormFieldsState>(
    () => ({
      errors:
        error === undefined || field === undefined
          ? nativeErrors
          : { ...nativeErrors, [field]: error },
      values: values ?? {},
      submissionId,
    }),
    [error, field, nativeErrors, submissionId, values],
  );

  return (
    <form
      ref={formRef}
      action={submit}
      className="grid gap-5"
      onInput={onInput}
      onInvalidCapture={onInvalidCapture}
    >
      <FormRejectionLiveRegion error={error} liveRegionRef={alertRef} />
      <FormFieldsContext value={state}>
        <fieldset
          className="grid min-w-0 gap-5"
          disabled={protectChanges && pending}
          key={submissionId}
        >
          {children}
        </fieldset>
      </FormFieldsContext>
      {protectChanges && pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saving. Please wait before leaving; this save cannot be canceled.
        </p>
      ) : null}
      <SubmitButton label={submitLabel} />
    </form>
  );
}
