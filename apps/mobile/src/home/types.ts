export type HomeViewModel = {
  householdLabel: string;
  members: { userId: string; displayName: string; isSelf: boolean }[];
  pets: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  routines: { id: string; title: string; areaName: string; paused: boolean }[];
  activity: { id: string; title: string }[];
};

export type InboxViewModel = {
  unreadCount: number;
  items: { id: string; title: string; body: string; read: boolean }[];
};
