# Feedback and release notes: owner operations

The Feedback form accepts one topic and nothing else. Codes are `easy_to_use`, `hard_to_use`, `slow`, `error`, and `more_features`. These are the proposed starter topics from the implementation plan. Individual submissions are account-bound for quota and idempotency; they are aggregate signals, not tickets or detailed bug reports.

## Inspect Feedback

Use the Supabase SQL editor as the project owner. Regular users have no direct table access. Never put the service-role key in a browser or distribute it to end users.

```sql
select topic_code, count(*) as submissions
from public.user_feedback
where created_at >= now() - interval '30 days'
group by topic_code
order by submissions desc, topic_code;

select (created_at at time zone 'Asia/Bangkok')::date as day,
       topic_code, count(*) as submissions
from public.user_feedback
where created_at >= now() - interval '30 days'
group by day, topic_code
order by day desc, topic_code;
```

New submissions are limited atomically to one per rolling minute and ten per rolling 24 hours per account. A retry with the same request ID and topic returns the original row before quota checks. Reusing that ID for another topic is rejected. No email, score, free text, screenshot, history page, or support response is collected.

## Draft a release

`published_at IS NULL` means draft. A future timestamp schedules visibility; approved users can read it only after that time. Choose a distinct version and the identity of the actual build. Each category's Thai and English arrays must have matching lengths, with at least one item overall. Use plain, nonempty text; the app does not execute HTML or Markdown. Limits: 20 items per category, 1,000 characters per item, 12,000 combined text characters, 200 characters per title, 64 for version, 128 for build ID. The detail query validates content as well; inspect it before publishing so malformed owner-authored content does not trigger the route's error state.

Prepare a row in the SQL editor or table editor without publishing it. Replace all example placeholders with verified release details first:

```sql
insert into public.release_notes (
  version, build_id, title_th, title_en,
  new_items_th, new_items_en,
  improved_items_th, improved_items_en,
  fixed_items_th, fixed_items_en,
  published_at
) values (
  'REPLACE_WITH_VERSION', 'REPLACE_WITH_DEPLOYED_BUILD_ID',
  'หัวข้อข่าวสารที่ตรวจสอบแล้ว', 'Verified release title',
  array['ข้อความเพิ่มใหม่ที่ตรวจสอบแล้ว'], array['Verified new feature'],
  array[]::text[], array[]::text[],
  array[]::text[], array[]::text[],
  null
)
returning id, version, build_id;
```

## Publish after hosted verification

Confirm that the migration is installed on the target system, the named build is deployed, and the announced behavior has passed verification there. Local QA and merge alone do not establish a hosted release. Check both translations before publishing. Use the draft's exact ID and build ID as guards:

```sql
update public.release_notes
set published_at = now()
where id = 'REPLACE_WITH_DRAFT_UUID'::uuid
  and build_id = 'REPLACE_WITH_DEPLOYED_BUILD_ID'
  and published_at is null
returning id, version, build_id, published_at;
```

The UI lists up to 50 latest releases at `/updates`; direct `/updates/<id>` links also work. Only the latest due release drives the menu's “New” marker. Opening the menu or detail does not mark it read. The optional Acknowledge button persists a stable timestamp for that account and release, shared across devices.

Use a new release row for another build or materially revised announcement. Read markers belong to the release ID, so editing a previously acknowledged row will not request another acknowledgement. There is no admin UI, email broadcast, automatic popup, or connection to individual Feedback.

## Data retention before hosted rollout

Agree and document the hosted retention period and privacy notice before enabling collection there. The local implementation does not add an automatic deletion job or silently choose a hosted retention policy. Suggested starting policy for owner review: retain raw account-bound Feedback for 90 days, export only non-identifying aggregate counts if needed, and delete older raw rows using an owner-controlled process. Keep at least the rolling 24-hour quota window. Account deletion cascades to that account's Feedback and read markers. Release content remains owner-managed.

## Delivery scope

`20261004120000_feedback_release_notes.sql` was applied locally, without reset or deploying. Published test rows are synthetic fixtures on local Supabase and are removed by tests. This task does not publish a real announcement or apply any hosted migration. Existing Login/security work stays separate.
