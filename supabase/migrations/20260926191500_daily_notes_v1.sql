-- Daily Notes V1: date context + optional link to a task created from a note.

alter table public.notes
  add column if not exists note_date date;

update public.notes
set note_date = (created_at at time zone 'Asia/Bangkok')::date
where note_date is null;

alter table public.notes
  alter column note_date set default ((now() at time zone 'Asia/Bangkok')::date),
  alter column note_date set not null;

alter table public.notes
  add column if not exists linked_task_id uuid references public.tasks(id) on delete set null;

create index if not exists notes_user_date_updated_idx
  on public.notes(user_id, note_date, archived_at, updated_at desc);
