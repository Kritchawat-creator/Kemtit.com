-- POC success metrics (Scope §14) — รันใน Supabase Studio (SQL editor) ด้วย service role
-- ทุก query อิง domain_events เป็น event log (R13) + task_completions/tasks

-- 1) Onboarding: สร้าง goal แรกได้เองใน session แรก = onboarding.completed ภายใน 30 นาทีหลังสมัคร
with signups as (
  select id as user_id, created_at as signed_up_at from auth.users
),
completed as (
  select user_id, min(created_at) as completed_at
  from public.domain_events
  where event_type = 'onboarding.completed'
  group by user_id
)
select
  count(*)                                                        as signups,
  count(c.user_id)                                                as completed_onboarding,
  count(*) filter (where c.completed_at - s.signed_up_at <= interval '30 minutes') as completed_in_first_session,
  round(100.0 * count(*) filter (where c.completed_at - s.signed_up_at <= interval '30 minutes') / greatest(count(*), 1), 1) as pct_first_session
from signups s
left join completed c using (user_id);

-- 2) Streak 7 วัน: user ที่มีวันทำ task เสร็จติดต่อกัน ≥ 7 วัน (นับรวม task_completions และ date(tasks.completed_at) ตาม Asia/Bangkok)
with days as (
  select user_id, completed_on as d from public.task_completions
  union
  select user_id, (completed_at at time zone 'Asia/Bangkok')::date as d from public.tasks where completed_at is not null
),
runs as (
  select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp
  from (select distinct user_id, d from days) x
),
streaks as (
  select user_id, count(*) as len, max(d) as last_day from runs group by user_id, grp
)
select
  count(distinct user_id) filter (where len >= 7) as users_with_7day_streak,
  count(distinct user_id)                          as users_with_any_completion,
  max(len)                                          as longest_streak
from streaks;

-- 3) LINE: อัตราการเชื่อม + push ที่ส่งต่อเดือน (กันชนโควตา R1)
select
  count(*) filter (where line_user_id is not null) as linked_users,
  count(*)                                         as total_users,
  round(100.0 * count(*) filter (where line_user_id is not null) / greatest(count(*), 1), 1) as pct_linked
from public.user_profiles;

select date_trunc('month', created_at at time zone 'Asia/Bangkok') as month,
       payload ->> 'kind' as kind,
       (payload ->> 'dryRun')::boolean as dry_run,
       count(*) as pushes
from public.domain_events
where event_type = 'notification.sent'
group by 1, 2, 3
order by 1 desc, 2;

-- 4) DAU (user ที่ทำ task เสร็จอย่างน้อย 1 ครั้ง/วัน) 14 วันล่าสุด
select (created_at at time zone 'Asia/Bangkok')::date as day, count(distinct user_id) as active_users
from public.domain_events
where event_type = 'task.completed' and created_at >= now() - interval '14 days'
group by 1
order by 1 desc;

-- 5) คิว event ค้าง / ล้มเหลว (debug cron)
select event_type, count(*) filter (where processed_at is null) as pending,
       count(*) filter (where processed_at is null and attempts >= 5) as dead,
       max(last_error) as sample_error
from public.domain_events
group by event_type
order by pending desc;
