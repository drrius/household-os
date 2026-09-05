const messages: readonly [string, string][] = [
  [
    "Refund shares exceed",
    "This refund exceeds what remains for one of you. Refresh the expense and review the remaining shares.",
  ],
  [
    "This expense has been reversed",
    "This expense has been reversed. Open its replacement to record a refund.",
  ],
  [
    "Reverse the active refunds",
    "Reverse the active refunds before correcting this expense.",
  ],
  [
    "financial event has already been corrected",
    "This event has already been corrected. Open its history to see the replacement.",
  ],
];

export function moneyCommandError(
  command: string,
  error: { message: string },
): Error {
  const known = messages.find(([match]) => error.message.includes(match));
  return new Error(known?.[1] ?? `${command} failed: ${error.message}`);
}
