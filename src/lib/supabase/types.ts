export type UserRole = 'owner' | 'office' | 'foreman' | 'client'
export type ProjectStatus = 'active' | 'completed' | 'on_hold'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'
export type ChangeOrderStatus =
  | 'draft'
  | 'submitted'
  | 'office_review'
  | 'sent_to_client'
  | 'approved'
  | 'rejected'
  | 'voided'
export type ChangeOrderReason =
  | 'scope_change'
  | 'unforeseen'
  | 'owner_request'
  | 'other'
export type LineItemCategory = 'labor' | 'material' | 'equipment' | 'subcontractor'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: UserRole
          company_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      companies: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      projects: {
        Row: {
          id: string
          company_id: string
          name: string
          address: string | null
          client_id: string | null
          status: ProjectStatus
          contract_value: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      project_users: {
        Row: {
          project_id: string
          user_id: string
          role: UserRole
        }
        Insert: Database['public']['Tables']['project_users']['Row']
        Update: Partial<Database['public']['Tables']['project_users']['Row']>
      }
      quotes: {
        Row: {
          id: string
          project_id: string
          version: number
          status: QuoteStatus
          subtotal: number
          tax_rate: number
          markup_percent: number
          total: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
      }
      quote_sections: {
        Row: {
          id: string
          quote_id: string
          name: string
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['quote_sections']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['quote_sections']['Insert']>
      }
      quote_line_items: {
        Row: {
          id: string
          section_id: string
          description: string
          quantity: number
          unit: string
          unit_cost: number
          markup_percent: number
          total: number
          cost_code: string | null
          category: LineItemCategory
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['quote_line_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['quote_line_items']['Insert']>
      }
      change_orders: {
        Row: {
          id: string
          project_id: string
          co_number: number
          title: string
          description: string | null
          status: ChangeOrderStatus
          reason: ChangeOrderReason
          submitted_by: string | null
          reviewed_by: string | null
          approved_by: string | null
          submitted_at: string | null
          reviewed_at: string | null
          client_responded_at: string | null
          subtotal: number
          markup_percent: number
          total: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['change_orders']['Row'], 'id' | 'co_number' | 'created_at'>
        Update: Partial<Database['public']['Tables']['change_orders']['Insert']>
      }
      change_order_line_items: {
        Row: {
          id: string
          change_order_id: string
          description: string
          quantity: number
          unit: string
          unit_cost: number
          markup_percent: number
          total: number
          cost_code: string | null
          category: LineItemCategory
        }
        Insert: Omit<Database['public']['Tables']['change_order_line_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['change_order_line_items']['Insert']>
      }
      change_order_attachments: {
        Row: {
          id: string
          change_order_id: string
          file_url: string
          file_name: string
          uploaded_by: string
          uploaded_at: string
        }
        Insert: Omit<Database['public']['Tables']['change_order_attachments']['Row'], 'id' | 'uploaded_at'>
        Update: Partial<Database['public']['Tables']['change_order_attachments']['Insert']>
      }
      change_order_comments: {
        Row: {
          id: string
          change_order_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['change_order_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['change_order_comments']['Insert']>
      }
    }
  }
}
