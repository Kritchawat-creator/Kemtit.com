export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      capture_confirmations: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          request_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          request_id: string
          status: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          request_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          blocks_time: boolean
          created_at: string
          data_origin: string
          end_time: string | null
          event_date: string
          external_source_id: string | null
          id: string
          notes: string | null
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          blocks_time?: boolean
          created_at?: string
          data_origin?: string
          end_time?: string | null
          event_date: string
          external_source_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          blocks_time?: boolean
          created_at?: string
          data_origin?: string
          end_time?: string | null
          event_date?: string
          external_source_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      external_calendar_connections: {
        Row: {
          account_label: string | null
          can_write: boolean
          created_at: string
          external_calendar_id: string | null
          granted_scopes: string[]
          id: string
          last_error: string | null
          last_sync_attempt_at: string | null
          last_synced_at: string | null
          provider: string
          provider_account_id: string
          status: string
          sync_lease_id: string | null
          sync_lease_until: string | null
          sync_status: string
          sync_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_label?: string | null
          can_write?: boolean
          created_at?: string
          external_calendar_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_sync_attempt_at?: string | null
          last_synced_at?: string | null
          provider: string
          provider_account_id: string
          status?: string
          sync_lease_id?: string | null
          sync_lease_until?: string | null
          sync_status?: string
          sync_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_label?: string | null
          can_write?: boolean
          created_at?: string
          external_calendar_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_sync_attempt_at?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_account_id?: string
          status?: string
          sync_lease_id?: string | null
          sync_lease_until?: string | null
          sync_status?: string
          sync_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      external_calendar_credentials: {
        Row: {
          access_token_ciphertext: string | null
          access_token_expires_at: string | null
          connection_id: string
          created_at: string
          refresh_token_ciphertext: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          connection_id: string
          created_at?: string
          refresh_token_ciphertext: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          connection_id?: string
          created_at?: string
          refresh_token_ciphertext?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_event_links: {
        Row: {
          connection_id: string
          created_at: string
          external_calendar_id: string
          external_etag: string | null
          external_event_id: string
          id: string
          last_synced_at: string | null
          local_event_id: string
          provider_updated_at: string | null
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          external_calendar_id: string
          external_etag?: string | null
          external_event_id: string
          id?: string
          last_synced_at?: string | null
          local_event_id: string
          provider_updated_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          external_calendar_id?: string
          external_etag?: string | null
          external_event_id?: string
          id?: string
          last_synced_at?: string | null
          local_event_id?: string
          provider_updated_at?: string | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_event_links_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_event_links_local_event_id_fkey"
            columns: ["local_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_event_sources: {
        Row: {
          all_day: boolean
          blocks_time: boolean
          connection_id: string
          created_at: string
          end_at: string | null
          end_date: string | null
          etag: string | null
          event_kind: string
          external_calendar_id: string
          external_event_id: string
          id: string
          last_seen_sync_id: string | null
          payload_hash: string
          provider_operation_id: string | null
          revision: string
          start_at: string | null
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day: boolean
          blocks_time: boolean
          connection_id: string
          created_at?: string
          end_at?: string | null
          end_date?: string | null
          etag?: string | null
          event_kind: string
          external_calendar_id: string
          external_event_id: string
          id?: string
          last_seen_sync_id?: string | null
          payload_hash: string
          provider_operation_id?: string | null
          revision?: string
          start_at?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          blocks_time?: boolean
          connection_id?: string
          created_at?: string
          end_at?: string | null
          end_date?: string | null
          etag?: string | null
          event_kind?: string
          external_calendar_id?: string
          external_event_id?: string
          id?: string
          last_seen_sync_id?: string | null
          payload_hash?: string
          provider_operation_id?: string | null
          revision?: string
          start_at?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_event_sources_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_operations: {
        Row: {
          connection_id: string
          created_at: string
          error_code: string | null
          external_event_id: string | null
          operation_id: string
          operation_kind: string
          payload_hash: string
          request_payload: Json
          source_event_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_code?: string | null
          external_event_id?: string | null
          operation_id: string
          operation_kind: string
          payload_hash: string
          request_payload: Json
          source_event_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_code?: string | null
          external_event_id?: string | null
          operation_id?: string
          operation_kind?: string
          payload_hash?: string
          request_payload?: Json
          source_event_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_operations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_operations_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_event_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bills: {
        Row: {
          amount: number | null
          created_at: string
          data_origin: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          recurrence_rule: string | null
          series_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          data_origin?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          recurrence_rule?: string | null
          series_id?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          data_origin?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          recurrence_rule?: string | null
          series_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          amount: number
          created_at: string
          data_origin: string
          id: string
          month_start: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          data_origin?: string
          id?: string
          month_start: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          data_origin?: string
          id?: string
          month_start?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          bill_id: string | null
          category: string | null
          created_at: string
          data_origin: string
          id: string
          notes: string | null
          occurred_on: string
          title: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          category?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          notes?: string | null
          occurred_on: string
          title: string
          transaction_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          category?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          notes?: string | null
          occurred_on?: string
          title?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "finance_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          body: string | null
          created_at: string
          data_origin: string
          id: string
          linked_task_id: string | null
          note_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          linked_task_id?: string | null
          note_date?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          linked_task_id?: string | null
          note_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          available_minutes: number
          created_at: string
          id: string
          notes: string | null
          plan_date: string
          top_priorities: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          available_minutes?: number
          created_at?: string
          id?: string
          notes?: string | null
          plan_date: string
          top_priorities?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          available_minutes?: number
          created_at?: string
          id?: string
          notes?: string | null
          plan_date?: string
          top_priorities?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          processing_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_goal_details: {
        Row: {
          created_at: string
          finance_type: string
          goal_id: string
          monthly_target: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finance_type: string
          goal_id: string
          monthly_target?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          finance_type?: string
          goal_id?: string
          monthly_target?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_goal_details_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_entries: {
        Row: {
          amount: number
          channel: string | null
          created_at: string
          data_origin: string
          entry_date: string
          entry_no: number
          goal_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          channel?: string | null
          created_at?: string
          data_origin?: string
          entry_date: string
          entry_no?: number
          goal_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          channel?: string | null
          created_at?: string
          data_origin?: string
          entry_date?: string
          entry_no?: number
          goal_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          archived_from_status: string | null
          completed_at: string | null
          created_at: string
          current_value: number
          data_origin: string
          domain: string
          goal_kind: string
          id: string
          parent_id: string | null
          period_start: string
          period_type: string
          persona_data: Json
          status: string
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_from_status?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          data_origin?: string
          domain?: string
          goal_kind?: string
          id?: string
          parent_id?: string | null
          period_start: string
          period_type: string
          persona_data?: Json
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          archived_from_status?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          data_origin?: string
          domain?: string
          goal_kind?: string
          id?: string
          parent_id?: string | null
          period_start?: string
          period_type?: string
          persona_data?: Json
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_completions: {
        Row: {
          completed_on: string
          created_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_on: string
          created_at?: string
          habit_id: string
          id?: string
          user_id?: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          cadence: string
          created_at: string
          data_origin: string
          domain: string
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          target_per_week: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cadence?: string
          created_at?: string
          data_origin?: string
          domain?: string
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          target_per_week?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          cadence?: string
          created_at?: string
          data_origin?: string
          domain?: string
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          target_per_week?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      item_registry: {
        Row: {
          created_at: string
          data_origin: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_origin?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data_origin?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      item_links: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          relation_type: string
          source_item_id: string
          target_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          relation_type: string
          source_item_id: string
          target_item_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          relation_type?: string
          source_item_id?: string
          target_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_links_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "item_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_links_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "item_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          archived_from_status: string | null
          created_at: string
          data_origin: string
          description: string | null
          domain: string
          goal_id: string | null
          id: string
          start_date: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_from_status?: string | null
          created_at?: string
          data_origin?: string
          description?: string | null
          domain?: string
          goal_id?: string | null
          id?: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          archived_from_status?: string | null
          created_at?: string
          data_origin?: string
          description?: string | null
          domain?: string
          goal_id?: string | null
          id?: string
          start_date?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_preferences: {
        Row: {
          break_windows: Json
          created_at: string
          timezone: string
          updated_at: string
          user_id: string
          working_windows: Json
        }
        Insert: {
          break_windows?: Json
          created_at?: string
          timezone?: string
          updated_at?: string
          user_id: string
          working_windows?: Json
        }
        Update: {
          break_windows?: Json
          created_at?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          working_windows?: Json
        }
        Relationships: []
      }
      rescue_operations: {
        Row: {
          after_state: Json
          before_state: Json
          created_at: string
          id: string
          plan: Json
          status: string
          target_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          after_state?: Json
          before_state?: Json
          created_at?: string
          id: string
          plan: Json
          status?: string
          target_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: string
          plan?: Json
          status?: string
          target_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_on: string
          created_at: string | null
          data_origin: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_on: string
          created_at?: string | null
          data_origin?: string
          id?: string
          task_id: string
          user_id?: string
        }
        Update: {
          completed_on?: string
          created_at?: string | null
          data_origin?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_occurrences: {
        Row: {
          completed_at: string | null
          created_at: string
          data_origin: string
          id: string
          occurrence_date: string
          scheduled_date: string
          scheduled_end: string | null
          scheduled_start: string | null
          skipped_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          occurrence_date: string
          scheduled_date: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          skipped_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_origin?: string
          id?: string
          occurrence_date?: string
          scheduled_date?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          skipped_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_occurrences_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          created_at: string
          id: string
          path: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_decisions: {
        Row: {
          accepted_entity_id: string | null
          accepted_entity_type: string | null
          created_at: string
          custom_title: string | null
          id: string
          status: string
          suggestion_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_entity_id?: string | null
          accepted_entity_type?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          status: string
          suggestion_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          accepted_entity_id?: string | null
          accepted_entity_type?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          status?: string
          suggestion_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived_at: string | null
          archived_from_status: string | null
          completed_at: string | null
          created_at: string
          data_origin: string
          deleted_at: string | null
          domain: string
          due_date: string | null
          deadline: string | null
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          notes: string | null
          planned_date: string | null
          persona_data: Json
          priority: string
          project_id: string | null
          recurrence_rule: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_from_status?: string | null
          completed_at?: string | null
          created_at?: string
          data_origin?: string
          deleted_at?: string | null
          domain?: string
          due_date?: string | null
          deadline?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          notes?: string | null
          planned_date?: string | null
          persona_data?: Json
          priority?: string
          project_id?: string | null
          recurrence_rule?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          archived_from_status?: string | null
          completed_at?: string | null
          created_at?: string
          data_origin?: string
          deleted_at?: string | null
          domain?: string
          due_date?: string | null
          deadline?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          notes?: string | null
          planned_date?: string | null
          persona_data?: Json
          priority?: string
          project_id?: string | null
          recurrence_rule?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          created_at: string
          data_origin: string
          end_at: string
          id: string
          is_locked: boolean
          source: string
          start_at: string
          status: string
          task_id: string | null
          task_occurrence_id: string | null
          title: string
          version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_origin?: string
          end_at: string
          id?: string
          is_locked?: boolean
          source?: string
          start_at: string
          status?: string
          task_id?: string | null
          task_occurrence_id?: string | null
          title: string
          version?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data_origin?: string
          end_at?: string
          id?: string
          is_locked?: boolean
          source?: string
          start_at?: string
          status?: string
          task_id?: string | null
          task_occurrence_id?: string | null
          title?: string
          version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_task_occurrence_id_fkey"
            columns: ["task_occurrence_id"]
            isOneToOne: false
            referencedRelation: "task_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          active_persona: string | null
          avatar_path: string | null
          created_at: string
          default_scope: string
          display_name: string | null
          focus_areas: string[]
          id: string
          last_overdue_notified_on: string | null
          line_link_code: string | null
          line_link_code_expires_at: string | null
          line_linked_at: string | null
          line_user_id: string | null
          notify_daily_brief: boolean
          notify_habits: boolean
          notify_investment: boolean
          notify_overdue: boolean
          notify_weekly_review: boolean
          onboarding_completed_at: string | null
          role_code: string | null
          subscription_tier: string
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          active_persona?: string | null
          avatar_path?: string | null
          created_at?: string
          default_scope?: string
          display_name?: string | null
          focus_areas?: string[]
          id: string
          last_overdue_notified_on?: string | null
          line_link_code?: string | null
          line_link_code_expires_at?: string | null
          line_linked_at?: string | null
          line_user_id?: string | null
          notify_daily_brief?: boolean
          notify_habits?: boolean
          notify_investment?: boolean
          notify_overdue?: boolean
          notify_weekly_review?: boolean
          onboarding_completed_at?: string | null
          role_code?: string | null
          subscription_tier?: string
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          active_persona?: string | null
          avatar_path?: string | null
          created_at?: string
          default_scope?: string
          display_name?: string | null
          focus_areas?: string[]
          id?: string
          last_overdue_notified_on?: string | null
          line_link_code?: string | null
          line_link_code_expires_at?: string | null
          line_linked_at?: string | null
          line_user_id?: string | null
          notify_daily_brief?: boolean
          notify_habits?: boolean
          notify_investment?: boolean
          notify_overdue?: boolean
          notify_weekly_review?: boolean
          onboarding_completed_at?: string | null
          role_code?: string | null
          subscription_tier?: string
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          blockers: string | null
          completed_at: string | null
          created_at: string
          id: string
          next_focus: string | null
          updated_at: string
          user_id: string
          week_start: string
          wins: string | null
        }
        Insert: {
          blockers?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          next_focus?: string | null
          updated_at?: string
          user_id?: string
          week_start: string
          wins?: string | null
        }
        Update: {
          blockers?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          next_focus?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
          wins?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_task_atomic: { Args: { p_task_id: string }; Returns: Json }
      restore_task_atomic: { Args: { p_task_id: string }; Returns: Json }
      archive_project_atomic: { Args: { p_project_id: string }; Returns: string }
      restore_project_atomic: { Args: { p_project_id: string }; Returns: string }
      archive_goal_atomic: { Args: { p_goal_id: string }; Returns: string }
      restore_goal_atomic: { Args: { p_goal_id: string }; Returns: string }
      claim_domain_events: {
        Args: { p_limit: number; p_max_attempts: number }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          processing_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "domain_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_goal_once: { Args: { p_goal_id: string }; Returns: boolean }
      create_goal_cascade: {
        Args: { p_from_template?: boolean; p_parent_id?: string; p_spec: Json }
        Returns: string
      }
      mark_finance_bill_paid: {
        Args: { p_bill_id: string; p_paid_on: string }
        Returns: string
      }
      create_time_block_atomic: {
        Args: {
          p_end_at: string
          p_source?: string
          p_start_at: string
          p_task_id?: string
          p_task_occurrence_id?: string
          p_title: string
        }
        Returns: string
      }
      set_time_block_status_atomic: {
        Args: { p_expected_version: number; p_id: string; p_status: string }
        Returns: string
      }
      update_time_block_atomic: {
        Args: {
          p_end_at: string
          p_expected_version: number
          p_id: string
          p_start_at: string
          p_title: string
        }
        Returns: string
      }
      reschedule_task_occurrence_atomic: {
        Args: {
          p_new_occurrence_date: string
          p_occurrence_date: string
          p_task_id: string
        }
        Returns: string
      }
      reschedule_task_atomic: {
        Args: { p_new_date: string; p_task_id: string }
        Returns: string
      }
      plan_inbox_task_atomic: {
        Args: { p_new_date: string; p_task_id: string }
        Returns: string
      }
      attach_task_photo_atomic: {
        Args: { p_path: string; p_task_id: string }
        Returns: string
      }
      persist_external_calendar_connection: {
        Args: {
          p_access_token_ciphertext: string
          p_access_token_expires_at: string
          p_account_id: string
          p_account_label: string | null
          p_calendar_id: string | null
          p_provider: string
          p_refresh_token_ciphertext: string | null
          p_scopes: string[]
          p_user_id: string
        }
        Returns: string
      }
      update_external_calendar_tokens: {
        Args: {
          p_access_token_ciphertext: string
          p_access_token_expires_at: string
          p_connection_id: string
          p_lease_id: string
          p_refresh_token_ciphertext: string | null
          p_scopes: string[]
          p_user_id: string
        }
        Returns: boolean
      }
      claim_external_calendar_sync: {
        Args: { p_connection_id: string; p_lease_id: string; p_user_id: string }
        Returns: boolean
      }
      renew_external_calendar_lease: {
        Args: { p_connection_id: string; p_lease_id: string; p_user_id: string }
        Returns: boolean
      }
      finish_external_calendar_sync_error: {
        Args: {
          p_connection_id: string
          p_error_code: string
          p_lease_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      apply_external_calendar_snapshot: {
        Args: {
          p_connection_id: string
          p_events: Json
          p_lease_id: string
          p_projection_end: string
          p_projection_start: string
          p_sync_id: string
          p_user_id: string
          p_window_end: string
          p_window_start: string
        }
        Returns: number
      }
      claim_external_calendar_operation: {
        Args: {
          p_connection_id: string
          p_expected_revision: string | null
          p_lease_id: string
          p_operation_id: string
          p_operation_kind: string
          p_payload_hash: string
          p_request_payload: Json
          p_source_event_id: string | null
          p_user_id: string
        }
        Returns: Json
      }
      finish_external_calendar_operation: {
        Args: {
          p_connection_id: string
          p_error_code: string | null
          p_lease_id: string
          p_operation_id: string
          p_projection_end: string
          p_projection_start: string
          p_provider_event: Json | null
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      disconnect_external_calendar_connection: {
        Args: { p_connection_id: string; p_user_id: string }
        Returns: boolean
      }
      update_task_with_blocks_atomic: {
        Args: {
          p_deadline: string | null
          p_domain: string
          p_due_date: string
          p_estimated_minutes: number | null
          p_goal_id: string | null
          p_notes: string | null
          p_planned_date: string | null
          p_priority: string
          p_project_id: string | null
          p_recurrence_rule: string | null
          p_task_id: string
          p_title: string
          p_update_deadline: boolean
          p_update_planned_date: boolean
        }
        Returns: string
      }
      carry_over_tasks_with_blocks_atomic: {
        Args: { p_new_date: string; p_task_ids: string[] }
        Returns: number
      }
      apply_rescue_operation: {
        Args: { p_operation_id: string; p_plan: Json; p_target_date: string }
        Returns: string
      }
      undo_rescue_operation: {
        Args: { p_operation_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
