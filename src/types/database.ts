export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      domain_events: {
        Row: {
          attempts: number;
          created_at: string;
          event_type: string;
          id: string;
          last_error: string | null;
          payload: Json;
          processed_at: string | null;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processed_at?: string | null;
          user_id: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processed_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          completed_at: string | null;
          created_at: string;
          current_value: number;
          domain: string;
          goal_kind: string;
          id: string;
          parent_id: string | null;
          period_start: string;
          period_type: string;
          persona_data: Json;
          status: string;
          target_value: number | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          current_value?: number;
          domain?: string;
          goal_kind?: string;
          id?: string;
          parent_id?: string | null;
          period_start: string;
          period_type: string;
          persona_data?: Json;
          status?: string;
          target_value?: number | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          current_value?: number;
          domain?: string;
          goal_kind?: string;
          id?: string;
          parent_id?: string | null;
          period_start?: string;
          period_type?: string;
          persona_data?: Json;
          status?: string;
          target_value?: number | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      task_completions: {
        Row: {
          completed_on: string;
          created_at: string | null;
          id: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          completed_on: string;
          created_at?: string | null;
          id?: string;
          task_id: string;
          user_id?: string;
        };
        Update: {
          completed_on?: string;
          created_at?: string | null;
          id?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          domain: string;
          due_date: string;
          goal_id: string | null;
          id: string;
          persona_data: Json;
          recurrence_rule: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          domain?: string;
          due_date: string;
          goal_id?: string | null;
          id?: string;
          persona_data?: Json;
          recurrence_rule?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          domain?: string;
          due_date?: string;
          goal_id?: string | null;
          id?: string;
          persona_data?: Json;
          recurrence_rule?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          active_persona: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          last_overdue_notified_on: string | null;
          line_link_code: string | null;
          line_link_code_expires_at: string | null;
          line_linked_at: string | null;
          line_user_id: string | null;
          notify_overdue: boolean;
          onboarding_completed_at: string | null;
          subscription_tier: string;
          updated_at: string;
        };
        Insert: {
          active_persona?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          last_overdue_notified_on?: string | null;
          line_link_code?: string | null;
          line_link_code_expires_at?: string | null;
          line_linked_at?: string | null;
          line_user_id?: string | null;
          notify_overdue?: boolean;
          onboarding_completed_at?: string | null;
          subscription_tier?: string;
          updated_at?: string;
        };
        Update: {
          active_persona?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          last_overdue_notified_on?: string | null;
          line_link_code?: string | null;
          line_link_code_expires_at?: string | null;
          line_linked_at?: string | null;
          line_user_id?: string | null;
          notify_overdue?: boolean;
          onboarding_completed_at?: string | null;
          subscription_tier?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
