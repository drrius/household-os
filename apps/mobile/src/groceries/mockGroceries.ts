import type { GroceriesViewModel } from "./types";

export const mockGroceries: GroceriesViewModel = {
  activeItemCount: 6,
  categories: [
    {
      id: "cat-produce",
      name: "Produce",
      items: [
        {
          id: "item-1",
          name: "Apples",
          quantity: "6",
          unit: null,
          note: null,
          claimedByName: null,
          claimedByMe: false,
        },
        {
          id: "item-2",
          name: "Spinach",
          quantity: "200",
          unit: "g",
          note: null,
          claimedByName: "Sam",
          claimedByMe: false,
        },
      ],
    },
    {
      id: "cat-dairy",
      name: "Dairy",
      items: [
        {
          id: "item-3",
          name: "Milk",
          quantity: "1",
          unit: "L",
          note: null,
          claimedByName: null,
          claimedByMe: false,
        },
      ],
    },
  ],
  liveSession: {
    memberName: "Sam",
    claimedCount: 1,
    totalCount: 6,
    isMine: false,
  },
  duplicateCount: 0,
  historyLabel: "12 items purchased in the last 30 days",
};
