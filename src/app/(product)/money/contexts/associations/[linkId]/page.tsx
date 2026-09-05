import { loadHouseholdMembers } from "@/app/(product)/_actions/m7-shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { costTargetHref } from "@/domain/money/cost-target";
import { loadAssociationById } from "@/lib/connected/cost-associations";
import { AssociationConfirmation } from "@/ui/money/association-confirmation.client";
import { FormPage } from "@/ui/forms/form-page";
import { associateExpenseAction } from "../../association-actions";
export default async function Page({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const input = await params;
  const id = z.uuid().safeParse(input.linkId);
  if (!id.success) notFound();
  const item = await loadAssociationById(id.data);
  if (!item?.association || !item.currentTarget) notFound();
  const title = item.current
    ? [item.current.record.title, item.current.booking?.title]
        .filter(Boolean)
        .join(" · ")
    : "Household record";
  const members = await loadHouseholdMembers();
  return (
    <FormPage
      title="Manage expense association"
      description="Keep your paid costs connected to the right household record."
      backHref={costTargetHref(item.currentTarget)}
    >
      <p>
        To move this payment,{" "}
        <Link className="underline" href="/money/contexts">
          choose another record
        </Link>{" "}
        and select “Link recorded expense”.
      </p>
      <AssociationConfirmation
        key={item.expense.id}
        action={associateExpenseAction.bind(null, item.expense.id, null)}
        expense={item.expense}
        payerName={
          members.find(
            (member) => member.user_id === item.expense.payer_member_id,
          )?.display_name ?? "Household member"
        }
        currentTitle={title}
        destinationTitle={null}
        revision={item.association.revision}
        requestId={crypto.randomUUID()}
      />
    </FormPage>
  );
}
