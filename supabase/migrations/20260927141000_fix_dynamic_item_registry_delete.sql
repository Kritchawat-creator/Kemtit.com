-- A shared DELETE trigger runs against several different row types. Read the
-- finance-only field through JSON so calendar, bill, note, and other deletes
-- do not try to resolve transaction_type on their dynamic OLD record.
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
    when 'finance_transactions' then to_jsonb(old)->>'transaction_type'
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
