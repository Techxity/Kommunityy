export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      communities: {
        Row: {
          accept_ngn: boolean
          accept_usd: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          accept_ngn?: boolean
          accept_usd?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          accept_ngn?: boolean
          accept_usd?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      donation_payments: {
        Row: {
          amount: number
          currency: Database["public"]["Enums"]["payment_currency"]
          donation_id: string
          id: string
          paid_at: string
          payer_email: string | null
          payer_name: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          currency: Database["public"]["Enums"]["payment_currency"]
          donation_id: string
          id?: string
          paid_at?: string
          payer_email?: string | null
          payer_name: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          currency?: Database["public"]["Enums"]["payment_currency"]
          donation_id?: string
          id?: string
          paid_at?: string
          payer_email?: string | null
          payer_name?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "donation_payments_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donation_totals"
            referencedColumns: ["donation_id"]
          },
          {
            foreignKeyName: "donation_payments_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          community_id: string
          created_at: string
          deadline: string | null
          id: string
          paystack_page_slug: string | null
          purpose: string
          shareable_slug: string
          status: Database["public"]["Enums"]["donation_status"]
          stripe_product_id: string | null
          target_ngn: number | null
          target_usd: number | null
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          deadline?: string | null
          id?: string
          paystack_page_slug?: string | null
          purpose: string
          shareable_slug: string
          status?: Database["public"]["Enums"]["donation_status"]
          stripe_product_id?: string | null
          target_ngn?: number | null
          target_usd?: number | null
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          deadline?: string | null
          id?: string
          paystack_page_slug?: string | null
          purpose?: string
          shareable_slug?: string
          status?: Database["public"]["Enums"]["donation_status"]
          stripe_product_id?: string | null
          target_ngn?: number | null
          target_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      dues_payments: {
        Row: {
          amount: number
          currency: Database["public"]["Enums"]["payment_currency"]
          id: string
          member_email: string | null
          member_name: string
          paid_at: string
          plan_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          currency: Database["public"]["Enums"]["payment_currency"]
          id?: string
          member_email?: string | null
          member_name: string
          paid_at?: string
          plan_id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          currency?: Database["public"]["Enums"]["payment_currency"]
          id?: string
          member_email?: string | null
          member_name?: string
          paid_at?: string
          plan_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dues_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "dues_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dues_plans: {
        Row: {
          active: boolean
          amount_ngn: number | null
          amount_usd: number | null
          community_id: string
          created_at: string
          id: string
          interval: Database["public"]["Enums"]["dues_interval"]
          name: string
          paystack_plan_code: string | null
          stripe_price_id: string | null
        }
        Insert: {
          active?: boolean
          amount_ngn?: number | null
          amount_usd?: number | null
          community_id: string
          created_at?: string
          id?: string
          interval: Database["public"]["Enums"]["dues_interval"]
          name?: string
          paystack_plan_code?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          active?: boolean
          amount_ngn?: number | null
          amount_usd?: number | null
          community_id?: string
          created_at?: string
          id?: string
          interval?: Database["public"]["Enums"]["dues_interval"]
          name?: string
          paystack_plan_code?: string | null
          stripe_price_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dues_plans_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      donation_totals: {
        Row: {
          collected_ngn: number | null
          collected_usd: number | null
          donation_id: string | null
          payer_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      donation_status: "active" | "closed"
      dues_interval: "monthly" | "quarterly" | "yearly"
      payment_currency: "NGN" | "USD"
      payment_provider: "paystack" | "stripe"
      payment_status: "paid" | "failed" | "refunded" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      donation_status: ["active", "closed"],
      dues_interval: ["monthly", "quarterly", "yearly"],
      payment_currency: ["NGN", "USD"],
      payment_provider: ["paystack", "stripe"],
      payment_status: ["paid", "failed", "refunded", "pending"],
    },
  },
} as const
