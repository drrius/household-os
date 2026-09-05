import { SecurityScreen } from "./security-screen";
import { requireMemberContext } from "@/lib/auth/member-context";

export default async function SecurityPage() {
  await requireMemberContext();
  return <SecurityScreen />;
}
