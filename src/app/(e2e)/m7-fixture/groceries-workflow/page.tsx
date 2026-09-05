import { notFound } from "next/navigation";
import { GroceryFixture } from "./fixture.client";

export default function GroceryFixturePage() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return <GroceryFixture />;
}
