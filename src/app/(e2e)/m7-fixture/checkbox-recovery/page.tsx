import { notFound } from "next/navigation";
import CheckboxRecoveryFixture from "./fixture.client";

export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return <CheckboxRecoveryFixture />;
}
