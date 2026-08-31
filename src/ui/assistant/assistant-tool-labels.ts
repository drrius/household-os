/** Present progressive while the tool runs; past tense once it has landed. */
const TOOL_LABELS: Record<string, readonly [string, string]> = {
  get_today_overview: ["Checking today", "Checked today"],
  get_routines: ["Looking up routines", "Looked up routines"],
  get_week_plan: ["Reading the meal plan", "Read the meal plan"],
  get_grocery_list: ["Reading the grocery list", "Read the grocery list"],
  get_money_overview: ["Checking the money picture", "Checked the money"],
  get_household: ["Looking up the household", "Looked up the household"],
  create_routine: ["Creating a routine", "Created a routine"],
  update_routine: ["Updating a routine", "Updated a routine"],
  pause_routine: ["Pausing a routine", "Paused a routine"],
  unpause_routine: ["Resuming a routine", "Resumed a routine"],
  archive_routine: ["Archiving a routine", "Archived a routine"],
  complete_occurrence: ["Completing a task", "Completed a task"],
  skip_occurrence: ["Skipping a task", "Skipped a task"],
  reschedule_occurrence: ["Rescheduling a task", "Rescheduled a task"],
  add_grocery_item: ["Adding a grocery item", "Added a grocery item"],
  remove_grocery_item: ["Removing a grocery item", "Removed a grocery item"],
  start_shopping_session: ["Starting shopping", "Started shopping"],
  claim_grocery_item: ["Claiming a grocery item", "Claimed a grocery item"],
  release_grocery_item: ["Releasing a grocery item", "Released a grocery item"],
  finish_shopping_session: ["Finishing shopping", "Finished shopping"],
  plan_meal: ["Planning a meal", "Planned a meal"],
  move_meal_entry: ["Moving a meal", "Moved a meal"],
  update_meal_entry: ["Updating a meal", "Updated a meal"],
  remove_meal_entry: ["Removing a meal", "Removed a meal"],
  create_meal_preparation: ["Adding a prep task", "Added a prep task"],
  create_area: ["Creating an area", "Created an area"],
  create_pet: ["Adding a pet", "Added a pet"],
  update_household_name: ["Renaming the household", "Renamed the household"],
  dismiss_expense_draft: ["Dismissing a draft", "Dismissed a draft"],
  create_recurring_expense_rule: [
    "Creating a recurring expense",
    "Created a recurring expense",
  ],
  set_recurring_expense_rule_active: [
    "Switching a recurring expense",
    "Switched a recurring expense",
  ],
  record_expense: ["Recording an expense", "Recorded an expense"],
  record_refund: ["Recording a refund", "Recorded a refund"],
  record_settlement: ["Recording a settlement", "Recorded a settlement"],
  establish_opening_balance: [
    "Setting the opening balance",
    "Set the opening balance",
  ],
  confirm_expense_draft: ["Confirming a draft", "Confirmed a draft"],
  correct_financial_event: ["Correcting a money event", "Corrected the event"],
};

/**
 * The question an approval card asks. Every key here writes to the
 * append-only financial ledger, which is what earns the permanence warning.
 */
const APPROVAL_TITLES: Record<string, string> = {
  record_expense: "Record this expense?",
  record_refund: "Record this refund?",
  record_settlement: "Record this settlement?",
  establish_opening_balance: "Set the opening balance?",
  confirm_expense_draft: "Confirm this expense?",
  correct_financial_event: "Correct this money event?",
};

export type ActivityTone = "running" | "done" | "skipped" | "failed";

function toolLabel(name: string, settled: boolean): string {
  const labels = TOOL_LABELS[name];
  if (labels === undefined) {
    return name.replaceAll("_", " ");
  }
  return settled ? labels[1] : labels[0];
}

export function approvalTitle(name: string): string {
  return APPROVAL_TITLES[name] ?? `${toolLabel(name, false)}?`;
}

export function isFinancialTool(name: string): boolean {
  return name in APPROVAL_TITLES;
}

export function activityTone(state: string): ActivityTone {
  switch (state) {
    case "output-available": {
      return "done";
    }
    case "output-denied": {
      return "skipped";
    }
    case "output-error": {
      return "failed";
    }
    default: {
      return "running";
    }
  }
}

/** Neither a denied nor a failed call happened, so both stay progressive. */
export function activityLabel(name: string, tone: ActivityTone): string {
  switch (tone) {
    case "skipped": {
      return `${toolLabel(name, false)} — not now`;
    }
    case "failed": {
      return `${toolLabel(name, false)} — didn't work`;
    }
    default: {
      return toolLabel(name, tone === "done");
    }
  }
}
