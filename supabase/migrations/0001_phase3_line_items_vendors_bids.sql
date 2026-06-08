-- ============================================================
-- Phase 3 migration: unified line items, vendors, vendor quotes,
-- bids (with version history), and contracts.
--
-- Safe to run on an existing Phase 1-2 database. Migrates data
-- out of quote_line_items / change_order_line_items into the new
-- unified line_items table, then drops the old tables.
-- ============================================================

-- ------------------------------------------------------------
-- Vendors (subs / third parties: painters, electricians, etc.)
-- ------------------------------------------------------------
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  trade text,                       -- free-form: painter, electrician, plumber, ...
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Vendor quotes (logged manually from email/text)
-- ------------------------------------------------------------
create table if not exists vendor_quotes (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  description text,
  amount numeric(12,2) not null default 0,
  status text not null default 'received'
    check (status in ('received', 'accepted', 'rejected', 'expired')),
  document_url text,                -- scanned/forwarded quote, if any
  received_at date,                 -- when the vendor sent it
  logged_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Unified line items (polymorphic: quotes + change orders)
-- ------------------------------------------------------------
create table if not exists line_items (
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

create index if not exists line_items_parent_idx on line_items (parent_type, parent_id);
create index if not exists line_items_section_idx on line_items (section_id);
create index if not exists line_items_vendor_quote_idx on line_items (vendor_quote_id);

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

drop trigger if exists line_items_parent_check on line_items;
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

drop trigger if exists quotes_delete_line_items on quotes;
create trigger quotes_delete_line_items
  before delete on quotes
  for each row execute procedure delete_line_items_for_parent('quote');

drop trigger if exists change_orders_delete_line_items on change_orders;
create trigger change_orders_delete_line_items
  before delete on change_orders
  for each row execute procedure delete_line_items_for_parent('change_order');

-- ------------------------------------------------------------
-- Migrate existing data into unified table
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_name = 'quote_line_items') then
    insert into line_items
      (parent_type, parent_id, section_id, description, quantity, unit,
       unit_cost, markup_percent, total, cost_code, category, sort_order)
    select 'quote', qs.quote_id, qli.section_id, qli.description, qli.quantity,
           qli.unit, qli.unit_cost, qli.markup_percent, qli.total, qli.cost_code,
           qli.category, qli.sort_order
    from quote_line_items qli
    join quote_sections qs on qs.id = qli.section_id;
  end if;

  if exists (select 1 from information_schema.tables
             where table_name = 'change_order_line_items') then
    insert into line_items
      (parent_type, parent_id, description, quantity, unit,
       unit_cost, markup_percent, total, cost_code, category, sort_order)
    select 'change_order', coli.change_order_id, coli.description, coli.quantity,
           coli.unit, coli.unit_cost, coli.markup_percent, coli.total,
           coli.cost_code, coli.category, 0
    from change_order_line_items coli;
  end if;
end $$;

drop table if exists quote_line_items;
drop table if exists change_order_line_items;

-- ------------------------------------------------------------
-- Bids (customer-facing snapshot of a quote, with version history)
-- ------------------------------------------------------------
create table if not exists bids (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null, -- source quote at time of bid
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

create index if not exists bids_project_idx on bids (project_id);

-- ------------------------------------------------------------
-- Contracts (created when a bid is accepted; tracks signature)
-- ------------------------------------------------------------
create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  bid_id uuid not null references bids(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'signed', 'voided')),
  contract_value numeric(12,2) not null default 0,
  signer_name text,
  signature_url text,               -- captured signature image / signed PDF
  signed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists contracts_project_idx on contracts (project_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table vendors enable row level security;
alter table vendor_quotes enable row level security;
alter table line_items enable row level security;
alter table bids enable row level security;
alter table contracts enable row level security;

-- Vendors: office/owner manage; all authenticated can read (company roster)
create policy "vendors_select" on vendors for select
  using (auth.uid() is not null);
create policy "vendors_write" on vendors for all
  using (my_role() in ('owner', 'office'));

-- Vendor quotes: readable by project members; office/owner write
create policy "vendor_quotes_select" on vendor_quotes for select
  using (on_project(project_id) or my_role() in ('owner', 'office'));
create policy "vendor_quotes_write" on vendor_quotes for all
  using (my_role() in ('owner', 'office'));

-- Line items: resolve parent to a project for read access.
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
