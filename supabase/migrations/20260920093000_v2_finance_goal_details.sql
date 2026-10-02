-- Kemtit V2 finance planning context.
-- Finance remains goal-driven; this extension classifies finance goals without
-- turning Kemtit into a trading or brokerage product.

create table public.finance_goal_details (
  goal_id uuid primary key references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  finance_type text not null
    check (finance_type in ('saving', 'investment', 'debt')),
  monthly_target numeric
    check (monthly_target is null or monthly_target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_goal_details_user_type_idx
  on public.finance_goal_details (user_id, finance_type, updated_at desc);

create trigger set_finance_goal_details_updated_at
  before update on public.finance_goal_details
  for each row execute function public.set_updated_at();

create function public.finance_goal_details_check_goal_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.goals g
    where g.id = new.goal_id
      and g.user_id = new.user_id
      and g.domain = 'finance'
      and g.goal_kind = 'metric'
  ) then
    raise exception 'finance detail must belong to an owned finance metric goal' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger finance_goal_details_goal_owner
  before insert or update on public.finance_goal_details
  for each row execute function public.finance_goal_details_check_goal_owner();

alter table public.finance_goal_details enable row level security;

create policy "finance_goal_details: select own"
  on public.finance_goal_details for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "finance_goal_details: insert own"
  on public.finance_goal_details for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "finance_goal_details: update own"
  on public.finance_goal_details for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "finance_goal_details: delete own"
  on public.finance_goal_details for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.finance_goal_details from anon;
