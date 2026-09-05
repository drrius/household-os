import { loadRecurringRules } from "@/lib/read-models/money-recurring";
import { RecurringScreen } from "@/ui/money/recurring-screen";
export default async function RecurringExpensesPage() {
  return <RecurringScreen rules={await loadRecurringRules()} />;
}
