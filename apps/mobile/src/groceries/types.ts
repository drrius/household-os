export type GroceryItemView = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
  claimedByName: string | null;
  claimedByMe: boolean;
};

export type GroceryCategoryView = {
  id: string;
  name: string;
  items: GroceryItemView[];
};

export type GroceriesViewModel = {
  activeItemCount: number;
  categories: GroceryCategoryView[];
  liveSession: {
    memberName: string;
    claimedCount: number;
    totalCount: number;
    isMine: boolean;
  } | null;
  duplicateCount: number;
  historyLabel: string | null;
};
