/**
 * Hand-written database types, generated from supabase/migrations/0001_init.sql
 * and 0003_phase7.sql rather than `supabase gen types typescript`, the
 * Supabase CLI on this machine is not authenticated/linked to the project
 * (see DECISIONS.md). Covers every table this rebuild reads or writes;
 * intentionally not exhaustive of every column (e.g. dispute admin-note
 * columns on bookings are omitted where unused by the frontend) since the
 * server modules in src/server/ are the source of truth for the full
 * shape and are plain JS, not typed against this file.
 *
 * Re-run `supabase gen types typescript --linked` once the CLI is
 * authenticated, and replace this file with the generated one.
 */

export type EscrowState =
  | "CREATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_HELD"
  | "DISPUTABLE"
  | "RELEASING"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED"
  | "CANCELLED";

export type ProfileRole =
  | "customer"
  | "crew_member"
  | "crew_manager"
  | "admin"
  | "field_worker"
  | "supervisor"
  | "crewbase_admin";

export type KycStatus = "pending" | "requires_action" | "verified" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          role: ProfileRole;
          avatar_url: string | null;
          abn: string | null;
          payment_provider: string;
          provider_account_id: string | null;
          kyc_status: KycStatus;
          rating_avg: number | null;
          rating_count: number;
          org_id: string | null;
          suburb: string | null;
          auth_provider: string | null;
          paused: boolean;
          paused_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      organisations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          logo_url: string | null;
          plan: "trial" | "starter" | "pro" | "enterprise";
          abn: string | null;
          provider_account_id: string | null;
          kyb_status: KycStatus;
          commission_tier: string;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          ref: string;
          customer_id: string | null;
          contractor_id: string | null;
          org_id: string | null;
          service_type: string;
          service_name: string | null;
          description: string | null;
          address: string | null;
          suburb: string | null;
          lat: number | null;
          lng: number | null;
          scheduled_at: string | null;
          total_cents: number;
          escrow_state: EscrowState;
          provider_escrow_id: string | null;
          payment_method: "bank_transfer" | "bpay" | "card" | null;
          payment_reference: string | null;
          dispute_deadline: string | null;
          auto_release_at: string | null;
          job_completed_at: string | null;
          completed_by: string | null;
          completed_at: string | null;
          payment_released_at: string | null;
          disputed_at: string | null;
          dispute_reason: string | null;
          dispute_notes: string | null;
          disputed_by: string | null;
          dispute_resolved_at: string | null;
          dispute_resolution: string | null;
          refunded_at: string | null;
          refund_amount: number | null;
          refund_reason: string | null;
          rating: number | null;
          rating_note: string | null;
          ledger_json: Record<string, unknown> | null;
          pricing_mode: "fixed" | "quoted";
          recurrence_rule: "weekly" | "fortnightly" | "monthly" | null;
          recurrence_remaining: number | null;
          recurrence_next_at: string | null;
          parent_booking_id: string | null;
          cancelled_at: string | null;
          cancellation_fee_cents: number;
          cancel_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          service_type: string;
          total_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
      };
      quotes: {
        Row: {
          id: string;
          booking_id: string;
          contractor_id: string;
          amount_cents: number;
          message: string | null;
          status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
          expires_at: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["quotes"]["Row"]> & {
          booking_id: string;
          contractor_id: string;
          amount_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Row"]>;
      };
      job_photos: {
        Row: {
          id: string;
          booking_id: string;
          uploader_id: string;
          kind: "before" | "after" | "evidence";
          storage_path: string;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["job_photos"]["Row"]> & {
          booking_id: string;
          uploader_id: string;
          kind: "before" | "after" | "evidence";
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_photos"]["Row"]>;
      };
      contractor_credentials: {
        Row: {
          id: string;
          profile_id: string;
          kind: "licence" | "insurance" | "photo_id";
          number: string | null;
          issuer: string | null;
          expires_at: string | null;
          verified: boolean;
          verified_at: string | null;
          verified_by: string | null;
          rejected_reason: string | null;
          document_path: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["contractor_credentials"]["Row"]> & {
          profile_id: string;
          kind: "licence" | "insurance" | "photo_id";
        };
        Update: Partial<Database["public"]["Tables"]["contractor_credentials"]["Row"]>;
      };
      availability: {
        Row: { id: number; profile_id: string; weekday: number; start_time: string; end_time: string };
        Relationships: never[];
        Insert: Omit<Database["public"]["Tables"]["availability"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["availability"]["Row"]>;
      };
      availability_exceptions: {
        Row: { id: number; profile_id: string; date: string; available: boolean };
        Relationships: never[];
        Insert: Omit<Database["public"]["Tables"]["availability_exceptions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["availability_exceptions"]["Row"]>;
      };
      service_areas: {
        Row: { profile_id: string; postcode: string };
        Relationships: never[];
        Insert: Database["public"]["Tables"]["service_areas"]["Row"];
        Update: Partial<Database["public"]["Tables"]["service_areas"]["Row"]>;
      };
      invoices: {
        Row: {
          id: number;
          invoice_number: string;
          booking_id: string;
          recipient: "customer" | "contractor";
          storage_path: string;
          total_cents: number | null;
          gst_cents: number | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          booking_id: string;
          recipient: "customer" | "contractor";
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
      };
      notifications: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          body: string | null;
          link: string | null;
          type: string;
          read: boolean;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      channels: {
        Row: { id: string; booking_id: string | null; org_id: string | null; created_at: string };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["channels"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["channels"]["Row"]>;
      };
      channel_members: {
        Row: { channel_id: string; user_id: string };
        Relationships: never[];
        Insert: Database["public"]["Tables"]["channel_members"]["Row"];
        Update: Partial<Database["public"]["Tables"]["channel_members"]["Row"]>;
      };
      messages: {
        Row: { id: number; channel_id: string; sender_id: string | null; content: string; created_at: string };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          channel_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
      community_reports: {
        Row: {
          id: string;
          ref: string;
          reporter_id: string | null;
          issue_type: string;
          description: string | null;
          location: string;
          lat: number | null;
          lng: number | null;
          severity: "Low" | "Medium" | "High" | "Critical";
          photo_url: string | null;
          status: "open" | "assigned" | "in_progress" | "resolved" | "closed";
          org_id: string | null;
          assigned_to: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["community_reports"]["Row"]> & {
          issue_type: string;
          location: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_reports"]["Row"]>;
      };
      beta_allowlist: {
        Row: { id: number; email: string; note: string | null; added_at: string };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["beta_allowlist"]["Row"]> & { email: string };
        Update: Partial<Database["public"]["Tables"]["beta_allowlist"]["Row"]>;
      };
      login_attempts: {
        Row: {
          id: number;
          email: string | null;
          outcome: string;
          note: string | null;
          user_agent: string | null;
          ip: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["login_attempts"]["Row"]> & { outcome: string };
        Update: Partial<Database["public"]["Tables"]["login_attempts"]["Row"]>;
      };
      push_subscriptions: {
        Row: {
          id: number;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Relationships: never[];
        Insert: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]> & {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
      };
    };
    Views: {
      contractor_public_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          rating_avg: number | null;
          rating_count: number;
          suburb: string | null;
        };
        Relationships: never[];
      };
      metrics_gmv_daily: { Row: { day: string; gmv_cents: number; bookings: number }; Relationships: never[] };
      metrics_take_rate: { Row: { day: string; take_rate: number }; Relationships: never[] };
      metrics_disputes: { Row: { day: string; dispute_ratio: number }; Relationships: never[] };
      metrics_time_to_match: { Row: { day: string; avg_minutes: number }; Relationships: never[] };
      metrics_contractor_utilisation: {
        Row: { contractor_id: string; full_name: string | null; jobs_completed: number };
        Relationships: never[];
      };
    };
    Functions: {
      is_beta_allowed: { Args: { p_email: string }; Returns: boolean };
      bump_rate_limit: { Args: { p_key: string; p_window_seconds: number; p_max: number }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
