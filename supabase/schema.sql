-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  phone text,
  logo_url text,
  created_at timestamptz default now()
);

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'office' check (role in ('owner', 'office', 'foreman', 'client')),
  company_id uuid references companies(id),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text,
  client_id uuid references profiles(id),
  status text not null default 'active' check (status in ('active', 'completed', 'on_hold')),
  contract_value numeric(12,2),
  created_at timestamptz default now()
);

-- Project ↔ User assignments (scopes access)
create table project_users (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'office', 'foreman', 'client')),
  primary key (project_id, user_id)
);

-- Quotes
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0,
  markup_percent numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table quote_sections (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

-- NOTE: line items are unified in the polymorphic `line_items` table below
-- (parent_type = 'quote' | 'change_order'). See Phase 3 section.

-- Vendors (subs / third parties: painters, electricians, plumbers, etc.)
create table vendors (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  trade text,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- Vendor quotes (logged manually from email/text)
create table vendor_quotes (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  description text,
  amount numeric(12,2) not null default 0,
  status text not null default 'received'
    check (status in ('received', 'accepted', 'rejected', 'expired')),
  document_url text,
  received_at date,
  logged_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Change Orders
create table change_orders (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  co_number integer not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'office_review', 'sent_to_client', 'approved', 'rejected', 'voided')),
  reason text not null default 'scope_change' check (reason in ('scope_change', 'unforeseen', 'owner_request', 'other')),
  submitted_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  client_responded_at timestamptz,
  subtotal numeric(12,2) not null default 0,
  markup_percent numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique (project_id, co_number)
);

-- Auto-increment co_number per project
create or replace function next_co_number(p_project_id uuid)
returns integer as $$
  select coalesce(max(co_number), 0) + 1
  from change_orders
  where project_id = p_project_id;
$$ language sql;

-- ------------------------------------------------------------
-- Unified line items (polymorphic: quotes + change orders)
-- ------------------------------------------------------------
create table line_items (
  id uuid primary key default uuid_generate_v4(),
  parent_type text not null check (parent_type in ('quote', 'change_order')),
  parent_id uuid not null,
  section_id uuid references quote_sections(id) on delete set null, -- quotes only
  vendor_quote_id uuid references vendor_quotes(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'ea',
  unit_cost numeric(12,2) not null default 0,
  markup_percent numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  cost_code text,
  category text not null default 'labor'
    check (category in ('labor', 'material', 'equipment', 'subcontractor')),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index line_items_parent_idx on line_items (parent_type, parent_id);
create index line_items_section_idx on line_items (section_id);
create index line_items_vendor_quote_idx on line_items (vendor_quote_id);

-- Integrity: parent_id has no real FK (polymorphic), so validate on write.
create or replace function line_items_check_parent()
returns trigger as $$
begin
  if new.parent_type = 'quote' then
    if not exists (select 1 from quotes where id = new.parent_id) then
      raise exception 'line_items.parent_id % is not a valid quote', new.parent_id;
    end if;
  elsif new.parent_type = 'change_order' then
    if not exists (select 1 from change_orders where id = new.parent_id) then
      raise exception 'line_items.parent_id % is not a valid change_order', new.parent_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger line_items_parent_check
  before insert or update on line_items
  for each row execute procedure line_items_check_parent();

-- Cascade cleanup: no real FK means deleting a parent won't auto-remove lines.
create or replace function delete_line_items_for_parent()
returns trigger as $$
begin
  delete from line_items
  where parent_type = tg_argv[0] and parent_id = old.id;
  return old;
end;
$$ language plpgsql;

create trigger quotes_delete_line_items
  before delete on quotes
  for each row execute procedure delete_line_items_for_parent('quote');

create trigger change_orders_delete_line_items
  before delete on change_orders
  for each row execute procedure delete_line_items_for_parent('change_order');

create table change_order_attachments (
  id uuid primary key default uuid_generate_v4(),
  change_order_id uuid not null references change_orders(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz default now()
);

create table change_order_comments (
  id uuid primary key default uuid_generate_v4(),
  change_order_id uuid not null references change_orders(id) on delete cascade,
  user_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Bids (customer-facing snapshot of a quote, with version history)
-- ------------------------------------------------------------
create table bids (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  version integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'superseded')),
  total numeric(12,2) not null default 0,
  snapshot jsonb,                   -- frozen line items + totals at send time
  notes text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (project_id, version)
);

create index bids_project_idx on bids (project_id);

-- ------------------------------------------------------------
-- Contracts (created when a bid is accepted; tracks signature)
-- ------------------------------------------------------------
create table contracts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  bid_id uuid not null references bids(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'signed', 'voided')),
  contract_value numeric(12,2) not null default 0,
  signer_name text,
  signature_url text,
  signed_at timestamptz,
  created_at timestamptz default now()
);

create index contracts_project_idx on contracts (project_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table companies enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_users enable row level security;
alter table quotes enable row level security;
alter table quote_sections enable row level security;
alter table change_orders enable row level security;
alter table change_order_attachments enable row level security;
alter table change_order_comments enable row level security;
alter table vendors enable row level security;
alter table vendor_quotes enable row level security;
alter table line_items enable row level security;
alter table bids enable row level security;
alter table contracts enable row level security;

-- Helper: get current user's role
create or replace function my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer;

-- Helper: check if user is on a project
create or replace function on_project(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from project_users
    where project_id = p_project_id and user_id = auth.uid()
  );
$$ language sql security definer;

-- Profiles: users see their own; owners/office see all in company
create policy "profiles_select" on profiles for select
  using (
    id = auth.uid()
    or my_role() in ('owner', 'office')
  );

create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update" on profiles for update
  using (id = auth.uid() or my_role() = 'owner');

-- Companies: visible to authenticated users
create policy "companies_select" on companies for select
  using (auth.uid() is not null);

create policy "companies_manage" on companies for all
  using (my_role() = 'owner');

-- Projects: visible to assigned users
create policy "projects_select" on projects for select
  using (on_project(id) or my_role() in ('owner', 'office'));

create policy "projects_insert" on projects for insert
  with check (my_role() in ('owner', 'office'));

create policy "projects_update" on projects for update
  using (my_role() in ('owner', 'office'));

-- Project users: manage assignments
create policy "project_users_select" on project_users for select
  using (user_id = auth.uid() or my_role() in ('owner', 'office'));

create policy "project_users_manage" on project_users for all
  using (my_role() in ('owner', 'office'));

-- Quotes: project members can read; office/owner can write
create policy "quotes_select" on quotes for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));

create policy "quotes_write" on quotes for all
  using (my_role() in ('owner', 'office'));

create policy "quote_sections_select" on quote_sections for select
  using (exists (select 1 from quotes q where q.id = quote_id and (on_project(q.project_id) or my_role() in ('owner', 'office'))));

create policy "quote_sections_write" on quote_sections for all
  using (my_role() in ('owner', 'office'));

-- Change orders: project members can read; foremen can insert; office/owner can update
create policy "co_select" on change_orders for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));

create policy "co_insert" on change_orders for insert
  with check (on_project(project_id) and my_role() in ('owner', 'office', 'foreman'));

create policy "co_update" on change_orders for update
  using (on_project(project_id) and my_role() in ('owner', 'office', 'foreman'));

create policy "co_attachments_select" on change_order_attachments for select
  using (exists (select 1 from change_orders co where co.id = change_order_id and (on_project(co.project_id) or my_role() in ('owner', 'office'))));

create policy "co_attachments_write" on change_order_attachments for all
  using (exists (select 1 from change_orders co where co.id = change_order_id and on_project(co.project_id)));

create policy "co_comments_select" on change_order_comments for select
  using (exists (select 1 from change_orders co where co.id = change_order_id and (on_project(co.project_id) or my_role() in ('owner', 'office'))));

create policy "co_comments_write" on change_order_comments for all
  using (exists (select 1 from change_orders co where co.id = change_order_id and on_project(co.project_id)));

-- Vendors: all authenticated read (company roster); office/owner write
create policy "vendors_select" on vendors for select
  using (auth.uid() is not null);
create policy "vendors_write" on vendors for all
  using (my_role() in ('owner', 'office'));

-- Vendor quotes: project members read; office/owner write
create policy "vendor_quotes_select" on vendor_quotes for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));
create policy "vendor_quotes_write" on vendor_quotes for all
  using (my_role() in ('owner', 'office'));

-- Line items: resolve polymorphic parent to a project for access checks.
create or replace function line_item_project(p_parent_type text, p_parent_id uuid)
returns uuid as $$
  select case p_parent_type
    when 'quote' then (select project_id from quotes where id = p_parent_id)
    when 'change_order' then (select project_id from change_orders where id = p_parent_id)
  end;
$$ language sql security definer;

create policy "line_items_select" on line_items for select
  using (
    on_project(line_item_project(parent_type, parent_id))
    or my_role() in ('owner', 'office')
  );

-- Quote lines: office/owner only. CO lines: any project member (field edits).
create policy "line_items_write" on line_items for all
  using (
    case parent_type
      when 'quote' then my_role() in ('owner', 'office')
      when 'change_order' then on_project(line_item_project(parent_type, parent_id))
    end
  );

-- Bids: project members read; office/owner write
create policy "bids_select" on bids for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));
create policy "bids_write" on bids for all
  using (my_role() in ('owner', 'office'));

-- Contracts: project members read; office/owner write
create policy "contracts_select" on contracts for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));
create policy "contracts_write" on contracts for all
  using (my_role() in ('owner', 'office'));

-- ============================================================
-- Storage bucket for CO attachments
-- ============================================================
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict do nothing;

create policy "attachments_select" on storage.objects for select
  using (bucket_id = 'attachments' and auth.uid() is not null);

create policy "attachments_insert" on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.uid() is not null);
