import type { PushInboxNotification } from "./push-payload.ts";

export type OutboxRow = {
  id: string;
  recipient_member_id: string;
  inbox_notification_id: string | null;
  household_id: string;
  attempt_count: number;
  claim_token: string;
  delivered_subscription_ids: string[];
  inbox: PushInboxNotification;
};

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushDeliveryDatabase = {
  public: {
    Tables: {
      push_subscriptions: {
        Row: PushSubscriptionRow & {
          household_id: string;
          member_id: string;
          disabled_at: string | null;
        };
        Insert: never;
        Update: { disabled_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      finalize_push_outbox_claim: {
        Args: {
          p_outbox_id: string;
          p_claim_token: string;
          p_outcome: string;
          p_error: string | null;
          p_delivered_subscription_ids: readonly string[];
        };
        Returns: boolean;
      };
      claim_push_outbox: {
        Args: {
          p_limit: number;
          p_lease_seconds: number;
          p_excluded_ids: string[];
        };
        Returns: OutboxRow[];
      };
    };
  };
};
