-- UX redesign: canonical domains required by Universal Quick Capture.
-- Typed tables own business data; item_registry remains identity/link metadata only.

-- ---------------------------------------------------------------------------
-- Internal calendar events
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  event_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 4000),
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM','TEMPLATE','SUGGESTED','EXAMPLE','USER','IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (all_day = true and start_time is null and end_time is null)
    or
    (all_day = false and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index calendar_events_user_date_idx
  on public.calendar_events(user_id, data_origin, event_date, start_time);

create trigger set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
create policy "calendar_events: select own" on public.calendar_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "calendar_events: insert own" on public.calendar_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "calendar_events: update own" on public.calendar_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "calendar_events: delete own" on public.calendar_events
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.calendar_events from anon;

-- ---------------------------------------------------------------------------
-- Finance operational model
-- ---------------------------------------------------------------------------
create table public.finance_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  series_id uuid not null default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(14,2) check (amount is null or amount >= 0),
  due_date date not null,
  status text not null default 'due' check (status in ('due','paid')),
  recurrence_rule text check (recurrence_rule is null or recurrence_rule in ('monthly')),
  paid_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 4000),
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM','TEMPLATE','SUGGESTED','EXAMPLE','USER','IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'paid' and paid_at is not null)
    or
    (status = 'due' and paid_at is null)
  ),
  unique(user_id, series_id, due_date)
);

create index finance_bills_user_due_idx
  on public.finance_bills(user_id, data_origin, status, due_date);

create trigger set_finance_bills_updated_at
  before update on public.finance_bills
  for each row execute function public.set_updated_at();

alter table public.finance_bills enable row level security;
create policy "finance_bills: select own" on public.finance_bills
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_bills: insert own" on public.finance_bills
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_bills: update own" on public.finance_bills
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "finance_bills: delete own" on public.finance_bills
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.finance_bills from anon;

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('expense','income')),
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(14,2) not null check (amount >= 0),
  occurred_on date not null,
  category text check (category is null or char_length(category) <= 80),
  bill_id uuid references public.finance_bills(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 4000),
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM','TEMPLATE','SUGGESTED','EXAMPLE','USER','IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (bill_id is null or transaction_type = 'expense')
);

create index finance_transactions_user_date_idx
  on public.finance_transactions(user_id, data_origin, occurred_on desc, transaction_type);

create trigger set_finance_transactions_updated_at
  before update on public.finance_transactions
  for each row execute function public.set_updated_at();

alter table public.finance_transactions enable row level security;
create policy "finance_transactions: select own" on public.finance_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_transactions: insert own" on public.finance_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_transactions: update own" on public.finance_transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "finance_transactions: delete own" on public.finance_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.finance_transactions from anon;

create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_start date not null,
  amount numeric(14,2) not null check (amount > 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM','TEMPLATE','SUGGESTED','EXAMPLE','USER','IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month_start)
);

create index finance_budgets_user_month_idx
  on public.finance_budgets(user_id, data_origin, month_start desc);

create trigger set_finance_budgets_updated_at
  before update on public.finance_budgets
  for each row execute function public.set_updated_at();

alter table public.finance_budgets enable row level security;
create policy "finance_budgets: select own" on public.finance_budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_budgets: insert own" on public.finance_budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_budgets: update own" on public.finance_budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "finance_budgets: delete own" on public.finance_budgets
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.finance_budgets from anon;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 10000),
  archived_at timestamptz,
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM','TEMPLATE','SUGGESTED','EXAMPLE','USER','IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_updated_idx
  on public.notes(user_id, data_origin, archived_at, updated_at desc);

create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
create policy "notes: select own" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes: insert own" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes: update own" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes: delete own" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.notes from anon;

-- Quick Capture idempotency now covers every canonical capture type.
alter table public.capture_confirmations
  drop constraint if exists capture_confirmations_entity_type_check;

alter table public.capture_confirmations
  add constraint capture_confirmations_entity_type_check
  check (
    entity_type is null
    or entity_type in ('task','goal','habit','event','bill','expense','note')
  );

-- ---------------------------------------------------------------------------
-- Extend shared identity to new canonical domains
-- ---------------------------------------------------------------------------
alter table public.item_registry
  drop constraint if exists item_registry_entity_type_check;

alter table public.item_registry
  add constraint item_registry_entity_type_check
  check (
    entity_type in (
      'goal','task','project','habit','event','bill','expense','income','note'
    )
  );

create or replace function public.sync_item_registry_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_old_type text;
begin
  v_type := case tg_table_name
    when 'goals' then 'goal'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'habits' then 'habit'
    when 'calendar_events' then 'event'
    when 'finance_bills' then 'bill'
    when 'notes' then 'note'
    when 'finance_transactions' then new.transaction_type
    else null
  end;

  if tg_op = 'UPDATE' then
    v_old_type := case tg_table_name
      when 'finance_transactions' then old.transaction_type
      else v_type
    end;
  end if;

  if v_type is null then
    raise exception 'unsupported registry table %', tg_table_name using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and (old.user_id <> new.user_id or v_old_type <> v_type) then
    delete from public.item_registry
    where user_id = old.user_id
      and entity_type = v_old_type
      and entity_id = old.id;
  end if;

  insert into public.item_registry(user_id, entity_type, entity_id, data_origin)
  values(new.user_id, v_type, new.id, new.data_origin)
  on conflict(user_id, entity_type, entity_id)
  do update set data_origin = excluded.data_origin;

  return new;
end
$$;

create or replace function public.remove_item_registry_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  v_type := case tg_table_name
    when 'goals' then 'goal'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'habits' then 'habit'
    when 'calendar_events' then 'event'
    when 'finance_bills' then 'bill'
    when 'notes' then 'note'
    when 'finance_transactions' then old.transaction_type
    else null
  end;

  if v_type is not null then
    delete from public.item_registry
    where user_id = old.user_id
      and entity_type = v_type
      and entity_id = old.id;
  end if;

  return old;
end
$$;

create trigger a_item_registry_calendar_events_write
  before insert or update of user_id, data_origin on public.calendar_events
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_finance_bills_write
  before insert or update of user_id, data_origin on public.finance_bills
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_finance_transactions_write
  before insert or update of user_id, data_origin, transaction_type on public.finance_transactions
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_notes_write
  before insert or update of user_id, data_origin on public.notes
  for each row execute function public.sync_item_registry_before_write();

create trigger z_item_registry_calendar_events_delete
  after delete on public.calendar_events
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_finance_bills_delete
  after delete on public.finance_bills
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_finance_transactions_delete
  after delete on public.finance_transactions
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_notes_delete
  after delete on public.notes
  for each row execute function public.remove_item_registry_after_delete();

-- Bill -> Expense relationship when a payment transaction references a bill.
create or replace function public.sync_finance_transaction_item_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_item uuid;
  v_tx_item uuid;
begin
  if new.transaction_type <> 'expense' then
    return new;
  end if;

  select id into v_tx_item
  from public.item_registry
  where user_id = new.user_id
    and entity_type = 'expense'
    and entity_id = new.id;

  delete from public.item_links
  where user_id = new.user_id
    and target_item_id = v_tx_item
    and relation_type = 'TRACKED_AS';

  if new.bill_id is not null then
    select id into v_bill_item
    from public.item_registry
    where user_id = new.user_id
      and entity_type = 'bill'
      and entity_id = new.bill_id;

    if v_bill_item is not null and v_tx_item is not null then
      insert into public.item_links(user_id, source_item_id, target_item_id, relation_type)
      values(new.user_id, v_bill_item, v_tx_item, 'TRACKED_AS')
      on conflict(source_item_id, target_item_id, relation_type) do nothing;
    end if;
  end if;

  return new;
end
$$;

create trigger b_item_links_finance_transactions
  after insert or update of bill_id, transaction_type on public.finance_transactions
  for each row execute function public.sync_finance_transaction_item_links();

-- Atomic "mark bill paid" flow. One bill remains canonical; payment becomes one
-- expense record linked through TRACKED_AS.
create or replace function public.mark_finance_bill_paid(
  p_bill_id uuid,
  p_paid_on date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.finance_bills%rowtype;
  v_transaction_id uuid;
begin
  select * into v_bill
  from public.finance_bills
  where id = p_bill_id
    and user_id = auth.uid()
  for update;

  if v_bill.id is null then
    raise exception 'bill not found' using errcode = 'P0002';
  end if;

  if v_bill.status = 'paid' then
    select id into v_transaction_id
    from public.finance_transactions
    where user_id = auth.uid()
      and bill_id = v_bill.id
      and transaction_type = 'expense'
    order by created_at desc
    limit 1;

    return v_transaction_id;
  end if;

  if v_bill.amount is null then
    raise exception 'bill amount is required before marking paid' using errcode = '23514';
  end if;

  insert into public.finance_transactions(
    user_id,
    transaction_type,
    title,
    amount,
    occurred_on,
    bill_id,
    data_origin
  )
  values(
    auth.uid(),
    'expense',
    v_bill.title,
    v_bill.amount,
    p_paid_on,
    v_bill.id,
    v_bill.data_origin
  )
  returning id into v_transaction_id;

  update public.finance_bills
  set status = 'paid',
      paid_at = now()
  where id = v_bill.id;

  if v_bill.recurrence_rule = 'monthly' then
    insert into public.finance_bills(
      user_id,
      series_id,
      title,
      amount,
      due_date,
      status,
      recurrence_rule,
      notes,
      data_origin
    )
    values(
      auth.uid(),
      v_bill.series_id,
      v_bill.title,
      v_bill.amount,
      (v_bill.due_date + interval '1 month')::date,
      'due',
      'monthly',
      v_bill.notes,
      v_bill.data_origin
    )
    on conflict(user_id, series_id, due_date) do nothing;
  end if;

  return v_transaction_id;
end
$$;

revoke all on function public.mark_finance_bill_paid(uuid, date) from public;
revoke all on function public.mark_finance_bill_paid(uuid, date) from anon;
grant execute on function public.mark_finance_bill_paid(uuid, date) to authenticated;
