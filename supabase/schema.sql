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

create table quote_line_items (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references quote_sections(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'ea',
  unit_cost numeric(12,2) not null default 0,
  markup_percent numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  cost_code text,
  category text not null default 'labor' check (category in ('labor', 'material', 'equipment', 'subcontractor')),
  sort_order integer not null default 0
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

create table change_order_line_items (
  id uuid primary key default uuid_generate_v4(),
  change_order_id uuid not null references change_orders(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'ea',
  unit_cost numeric(12,2) not null default 0,
  markup_percent numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  cost_code text,
  category text not null default 'labor' check (category in ('labor', 'material', 'equipment', 'subcontractor'))
);

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

-- ============================================================
-- Row Level Security
-- ============================================================

alter table companies enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_users enable row level security;
alter table quotes enable row level security;
alter table quote_sections enable row level security;
alter table quote_line_items enable row level security;
alter table change_orders enable row level security;
alter table change_order_line_items enable row level security;
alter table change_order_attachments enable row level security;
alter table change_order_comments enable row level security;

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

create policy "quote_line_items_select" on quote_line_items for select
  using (exists (
    select 1 from quote_sections qs
    join quotes q on q.id = qs.quote_id
    where qs.id = section_id and (on_project(q.project_id) or my_role() in ('owner', 'office'))
  ));

create policy "quote_line_items_write" on quote_line_items for all
  using (my_role() in ('owner', 'office'));

-- Change orders: project members can read; foremen can insert; office/owner can update
create policy "co_select" on change_orders for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));

create policy "co_insert" on change_orders for insert
  with check (on_project(project_id) and my_role() in ('owner', 'office', 'foreman'));

create policy "co_update" on change_orders for update
  using (on_project(project_id) and my_role() in ('owner', 'office', 'foreman'));

create policy "co_line_items_select" on change_order_line_items for select
  using (exists (select 1 from change_orders co where co.id = change_order_id and (on_project(co.project_id) or my_role() in ('owner', 'office'))));

create policy "co_line_items_write" on change_order_line_items for all
  using (exists (select 1 from change_orders co where co.id = change_order_id and on_project(co.project_id)));

create policy "co_attachments_select" on change_order_attachments for select
  using (exists (select 1 from change_orders co where co.id = change_order_id and (on_project(co.project_id) or my_role() in ('owner', 'office'))));

create policy "co_attachments_write" on change_order_attachments for all
  using (exists (select 1 from change_orders co where co.id = change_order_id and on_project(co.project_id)));

create policy "co_comments_select" on change_order_comments for select
  using (exists (select 1 from change_orders co where co.id = change_order_id and (on_project(co.project_id) or my_role() in ('owner', 'office'))));

create policy "co_comments_write" on change_order_comments for all
  using (exists (select 1 from change_orders co where co.id = change_order_id and on_project(co.project_id)));

-- ============================================================
-- Storage bucket for CO attachments
-- ============================================================
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict do nothing;

create policy "attachments_select" on storage.objects for select
  using (bucket_id = 'attachments' and auth.uid() is not null);

create policy "attachments_insert" on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.uid() is not null);
