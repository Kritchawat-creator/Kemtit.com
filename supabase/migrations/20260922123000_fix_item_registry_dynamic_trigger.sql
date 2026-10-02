-- A generic trigger cannot dereference NEW.transaction_type directly: PL/pgSQL
-- resolves record fields against the triggering table at runtime. Use JSON
-- extraction for the one table-specific field so goals/tasks remain writable.

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
    when 'finance_transactions' then to_jsonb(new)->>'transaction_type'
    else null
  end;

  if tg_op = 'UPDATE' then
    v_old_type := case tg_table_name
      when 'finance_transactions' then to_jsonb(old)->>'transaction_type'
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
