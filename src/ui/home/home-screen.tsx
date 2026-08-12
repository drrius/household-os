import Link from "next/link";

import { SECURITY_PATH } from "@/lib/auth/paths";
import type { HomeViewModel } from "@/lib/read-models/home";
import { AppPage } from "@/ui/primitives/app-page";
import { Button } from "@/ui/primitives/button";
import { Card } from "@/ui/primitives/card";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";
import { PageSection } from "@/ui/primitives/page-section";
import { StatusPill } from "@/ui/primitives/status-pill";

type HomeScreenProps = {
  model: HomeViewModel;
};

type HouseholdCardProps = {
  householdLabel: HomeViewModel["householdLabel"];
  members: HomeViewModel["members"];
};

function HouseholdCard({ householdLabel, members }: HouseholdCardProps) {
  return (
    <Card header={<h2 id="household-title">Household</h2>}>
      <div className="home-card-stack">
        <p className="home-card-lead">{householdLabel}</p>
        <ul className="home-list" aria-label="Household members">
          {members.map((member) => (
            <li className="home-row" key={member.userId}>
              <div className="home-row__copy">
                <strong>{member.displayName}</strong>
                <span className="home-row__meta">
                  {member.isSelf ? "You · Equal member" : "Equal member"}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="home-row__meta">
          Both members have equal access. Each person signs in with their own{" "}
          <Link href={SECURITY_PATH}>passkeys</Link>.
        </p>
      </div>
    </Card>
  );
}

type PetCardsProps = {
  pets: HomeViewModel["pets"];
};

function PetCards({ pets }: PetCardsProps) {
  if (pets.length === 0) {
    return null;
  }

  return (
    <PageSection title="Pets" titleId="pets-title">
      <div className="home-grid">
        {pets.map((pet) => (
          <Card key={pet.id} header={<h3>{pet.name}</h3>}>
            <p className="home-row__meta">{pet.meta}</p>
          </Card>
        ))}
      </div>
    </PageSection>
  );
}

type AreaListProps = {
  areas: HomeViewModel["areas"];
};

function AreaList({ areas }: AreaListProps) {
  if (areas.length === 0) {
    return (
      <EmptyState title="No routine areas yet">
        <p>Areas will appear here when household routines are organized.</p>
      </EmptyState>
    );
  }

  return (
    <Card>
      <ul className="home-list" aria-label="Routine areas">
        {areas.map((area) => (
          <li className="home-row" key={area.id}>
            <strong>{area.name}</strong>
            <StatusPill>
              {area.routineCount}{" "}
              {area.routineCount === 1 ? "routine" : "routines"}
            </StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type ActivityListProps = {
  activity: HomeViewModel["activity"];
};

function ActivityList({ activity }: ActivityListProps) {
  if (activity.length === 0) {
    return (
      <EmptyState title="Nothing here yet">
        <p>Meaningful household changes will appear here.</p>
      </EmptyState>
    );
  }

  return (
    <Card>
      <ol className="home-list" aria-label="Recent household activity">
        {activity.map((item) => (
          <li className="home-row" key={item.id}>
            <div className="home-row__copy">
              <strong>{item.title}</strong>
              <span className="home-row__meta">{item.whenLabel}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

type SettingsListProps = {
  storageUsedLabel: HomeViewModel["storageUsedLabel"];
};

function SettingsList({ storageUsedLabel }: SettingsListProps) {
  const storageHint =
    storageUsedLabel === null
      ? "Images only · Warning at 500 MB"
      : `${storageUsedLabel} used · Warning at 500 MB`;

  return (
    <Card>
      <ul className="home-list" aria-label="Household settings">
        <li className="home-row">
          <div className="home-row__copy">
            <strong>Notifications & digest</strong>
            <span className="home-row__meta">
              In-app notifications, optional push, and a personal digest
            </span>
          </div>
        </li>
        <li className="home-row">
          <Link className="home-settings-link" href={SECURITY_PATH}>
            <span className="home-row__copy">
              <strong>Passkeys & recovery</strong>
              <span className="home-row__meta">
                Manage authenticators and recovery access
              </span>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
        <li className="home-row">
          <div className="home-row__copy">
            <strong>Household settings</strong>
            <span className="home-row__meta">
              Household name and shared defaults
            </span>
          </div>
        </li>
        <li className="home-row">
          <div className="home-row__copy">
            <strong>Attachment storage</strong>
            <span className="home-row__meta">{storageHint}</span>
          </div>
        </li>
      </ul>
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
          <Button href="/home/routines/new" variant="ghost">
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
