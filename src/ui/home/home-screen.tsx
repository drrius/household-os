import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECURITY_PATH } from "@/lib/auth/paths";
import type { HomeViewModel } from "@/lib/read-models/home";
import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";
import { PageSection } from "@/ui/layout/page-section";

type HomeScreenProps = {
  model: HomeViewModel;
};

function HouseholdCard({
  householdLabel,
  members,
}: Pick<HomeViewModel, "householdLabel" | "members">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 id="household-title">Household</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xl font-extrabold">{householdLabel}</p>
        <ul className="list-none" aria-label="Household members">
          {members.map((member) => (
            <li
              className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0"
              key={member.userId}
            >
              <div className="grid min-w-0 gap-1">
                <strong>{member.displayName}</strong>
                <span className="text-xs text-muted-foreground">
                  {member.isSelf ? "You · Equal member" : "Equal member"}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Both members have equal access. Each person signs in with their own{" "}
          <Link href={SECURITY_PATH}>passkeys</Link>.
        </p>
      </CardContent>
    </Card>
  );
}

function PetCards({ pets }: Pick<HomeViewModel, "pets">) {
  if (pets.length === 0) {
    return null;
  }

  return (
    <PageSection title="Pets" titleId="pets-title">
      <div className="grid gap-4 sm:grid-cols-2">
        {pets.map((pet) => (
          <Card key={pet.id} size="sm">
            <CardHeader>
              <CardTitle>
                <h3>{pet.name}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{pet.meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageSection>
  );
}

function AreaList({ areas }: Pick<HomeViewModel, "areas">) {
  if (areas.length === 0) {
    return (
      <EmptyState title="No routine areas yet">
        <p>Areas will appear here when household routines are organized.</p>
      </EmptyState>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="list-none" aria-label="Routine areas">
          {areas.map((area) => (
            <li
              className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0"
              key={area.id}
            >
              <strong>{area.name}</strong>
              <Badge variant="secondary">
                {area.routineCount}{" "}
                {area.routineCount === 1 ? "routine" : "routines"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActivityList({ activity }: Pick<HomeViewModel, "activity">) {
  if (activity.length === 0) {
    return (
      <EmptyState title="Nothing here yet">
        <p>Meaningful household changes will appear here.</p>
      </EmptyState>
    );
  }

  return (
    <Card>
      <CardContent>
        <ol className="list-none" aria-label="Recent household activity">
          {activity.map((item) => (
            <li
              className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0"
              key={item.id}
            >
              <div className="grid min-w-0 gap-1">
                <strong className="wrap-anywhere">{item.title}</strong>
                <span className="text-xs text-muted-foreground">
                  {item.whenLabel}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function SettingsList({
  storageUsedLabel,
}: Pick<HomeViewModel, "storageUsedLabel">) {
  const storageHint =
    storageUsedLabel === null
      ? "Images only · Warning at 500 MB"
      : `${storageUsedLabel} used · Warning at 500 MB`;

  return (
    <Card>
      <CardContent>
        <ul className="list-none" aria-label="Household settings">
          <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
            <div className="grid min-w-0 gap-1">
              <strong>Notifications & digest</strong>
              <span className="text-xs text-muted-foreground">
                In-app notifications, optional push, and a personal digest
              </span>
            </div>
          </li>
          <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
            <Link
              className="flex min-h-11 w-full items-center justify-between gap-3 no-underline"
              href={SECURITY_PATH}
            >
              <span className="grid min-w-0 gap-1">
                <strong>Passkeys & recovery</strong>
                <span className="text-xs text-muted-foreground">
                  Manage authenticators and recovery access
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
          <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
            <div className="grid min-w-0 gap-1">
              <strong>Household settings</strong>
              <span className="text-xs text-muted-foreground">
                Household name and shared defaults
              </span>
            </div>
          </li>
          <li className="flex min-h-11 items-center justify-between gap-3 border-t py-3 first:border-t-0">
            <div className="grid min-w-0 gap-1">
              <strong>Attachment storage</strong>
              <span className="text-xs text-muted-foreground">
                {storageHint}
              </span>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

export function HomeScreen({ model }: HomeScreenProps) {
  return (
    <AppPage labelledBy="home-title">
      <PageHeader titleId="home-title" title="Our home" />
      <HouseholdCard
        householdLabel={model.householdLabel}
        members={model.members}
      />
      <PetCards pets={model.pets} />
      <PageSection
        action={
          <Button
            nativeButton={false}
            render={<Link href="/home/routines/new" />}
            variant="ghost"
          >
            Manage
          </Button>
        }
        title="Routines by area"
        titleId="routines-by-area-title"
      >
        <AreaList areas={model.areas} />
      </PageSection>
      <PageSection title="Lately" titleId="lately-title">
        <ActivityList activity={model.activity} />
      </PageSection>
      <PageSection title="Settings" titleId="settings-title">
        <SettingsList storageUsedLabel={model.storageUsedLabel} />
      </PageSection>
    </AppPage>
  );
}
