export type GroceriesViewModel = {
  activeItemCount: number;
  categories: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      quantity: string | null;
      unit: string | null;
      note: string | null;
      claimedByName: string | null;
      claimedByMe: boolean;
      duplicateHint: string | null;
    }>;
  }>;
  liveSession: null | {
    id: string;
    memberName: string;
    claimedCount: number;
    totalCount: number;
    isMine: boolean;
  };
  duplicates: Array<{
    leftId: string;
    rightId: string;
    leftName: string;
    rightName: string;
  }>;
  recentHistoryLabel: string | null;
  history?: Array<{
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    purchasedAt: string;
    mealId: string | null;
  }>;
  recentShops?: Array<{
    id: string;
    finishedAt: string;
    memberName: string;
    receiptTotalCents: number | null;
    draftId: string | null;
  }>;
};
