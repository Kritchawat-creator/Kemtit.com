-- Keep task photo authorization, object verification, replay handling, and the per-task limit
-- inside one transaction. The client may upload bytes only under its own Storage folder.
drop policy if exists "task_photos: insert own" on public.task_photos;
revoke insert on public.task_photos from authenticated;

create or replace function public.attach_task_photo_atomic(p_task_id uuid, p_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
  v_photo_id uuid;
  v_mime_type text;
  v_size_text text;
  v_size bigint;
  v_photo_count bigint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_task_id is null or p_path is null or char_length(p_path) > 300 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  if p_path !~ ('^' || v_user_id::text || '/' || p_task_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  -- Serialize all attachments to this task and make archive/delete checks current.
  select t.id
    into v_task_id
    from public.tasks t
   where t.id = p_task_id
     and t.user_id = v_user_id
     and t.archived_at is null
     and t.deleted_at is null
     and t.status <> 'archived'
   for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  select o.metadata ->> 'mimetype', o.metadata ->> 'size'
    into v_mime_type, v_size_text
    from storage.objects o
   where o.bucket_id = 'photos'
     and o.name = p_path;
  if not found then
    raise exception 'photo_object_missing' using errcode = 'P0001';
  end if;

  if v_size_text is null or v_size_text !~ '^[0-9]+$' then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;
  v_size := v_size_text::bigint;

  if v_size < 1 or v_size > 10485760
     or v_mime_type is null
     or v_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
     or (p_path ~ '[.]jpg$' and v_mime_type <> 'image/jpeg')
     or (p_path ~ '[.]png$' and v_mime_type <> 'image/png')
     or (p_path ~ '[.]webp$' and v_mime_type <> 'image/webp') then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;

  select tp.id
    into v_photo_id
    from public.task_photos tp
   where tp.task_id = p_task_id
     and tp.user_id = v_user_id
     and tp.path = p_path;
  if found then
    return v_photo_id;
  end if;

  select count(*)
    into v_photo_count
    from public.task_photos tp
   where tp.task_id = p_task_id;
  if v_photo_count >= 5 then
    raise exception 'photo_limit' using errcode = 'P0001';
  end if;

  insert into public.task_photos (task_id, user_id, path)
  values (p_task_id, v_user_id, p_path)
  returning id into v_photo_id;

  return v_photo_id;
end;
$function$;

revoke all on function public.attach_task_photo_atomic(uuid, text) from public, anon;
grant execute on function public.attach_task_photo_atomic(uuid, text) to authenticated;
