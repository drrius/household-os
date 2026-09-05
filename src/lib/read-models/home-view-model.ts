export type HomeViewModel = {
  householdLabel: string;
  members: Array<{ userId: string; displayName: string; isSelf: boolean }>;
  pets: Array<{ id: string; name: string; meta: string }>;
  areas: Array<{ id: string; name: string; routineCount: number }>;
  routines: Array<{
    id: string;
    title: string;
    areaName: string;
    paused?: boolean;
  }>;
  archivedRoutines?: Array<{ id: string; title: string }>;
  activity: Array<{ id: string; title: string; whenLabel: string }>;
  storageUsedLabel: string | null;
};
