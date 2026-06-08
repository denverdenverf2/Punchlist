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
      line_items: {
        Row: {
          id: string
          parent_type: 'quote' | 'change_order'
          parent_id: string
          section_id: string | null
          vendor_quote_id: string | null
          description: string
          quantity: number
          unit: string
          unit_cost: number
          markup_percent: number
          total: number
          cost_code: string | null
          category: LineItemCategory
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['line_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['line_items']['Insert']>
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
      vendors: {
        Row: {
          id: string
          company_id: string
          name: string
          trade: string | null
          contact_name: string | null
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
      }
      vendor_quotes: {
        Row: {
          id: string
          vendor_id: string
          project_id: string
          description: string | null
          amount: number
          status: 'received' | 'accepted' | 'rejected' | 'expired'
          document_url: string | null
          received_at: string | null
          logged_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendor_quotes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['vendor_quotes']['Insert']>
      }
      bids: {
        Row: {
          id: string
          project_id: string
          quote_id: string | null
          version: number
          status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'superseded'
          total: number
          snapshot: unknown | null
          notes: string | null
          sent_at: string | null
          responded_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bids']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bids']['Insert']>
      }
      contracts: {
        Row: {
          id: string
          project_id: string
          bid_id: string
          status: 'pending' | 'signed' | 'voided'
          contract_value: number
          signer_name: string | null
          signature_url: string | null
          signed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contracts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>
      }
    }
  }
}
