import Link from "next/link";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type SharedButtonProps = {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type LinkButtonProps = SharedButtonProps & {
  disabled?: never;
  href: string;
  type?: never;
};

type NativeButtonProps = SharedButtonProps & {
  disabled?: boolean;
  form?: string;
  href?: never;
  name?: string;
  type?: "button" | "submit" | "reset";
  value?: string;
};

export type ButtonProps = LinkButtonProps | NativeButtonProps;

function getVariantClassName(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      return "button--primary";
    case "secondary":
      return "button--secondary";
    case "ghost":
      return "button--ghost";
    case "danger":
      return "button--danger";
    default: {
      const exhaustiveVariant: never = variant;
      return exhaustiveVariant;
    }
  }
}

export function Button(props: ButtonProps) {
  const {
    "aria-label": ariaLabel,
    children,
    className,
    variant = "primary",
  } = props;
  const classes = ["button", getVariantClassName(variant), className]
    .filter(Boolean)
    .join(" ");

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={classes}
      disabled={props.disabled}
      form={props.form}
      name={props.name}
      type={props.type ?? "button"}
      value={props.value}
    >
      {children}
    </button>
  );
}
