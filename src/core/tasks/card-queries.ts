import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { signPhotoUrls } from "@/core/photos/queries";

import type { TaskWithGoal } from "./schema";

export type TaskCardPhoto = {
  id: string;
  task_id: string;
  path: string;
  sort_order: number;
  url: string | null;
};
export type TaskCardGroup = {
  id: string;
  user_id: string;
  title: string;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
};
export type TaskCardPendingPhoto = {
  task_id: string;
  operation_id: string;
  path: string;
  sort_order: number;
  status: "reserved" | "failed";
  failure_code: "upload_failed" | "upload_unknown" | null;
};
export type TaskCardLinkedBlock = {
  id: string;
  task_id: string;
  task_occurrence_id: string | null;
  occurrence_date: string | null;
  start_at: string;
  end_at: string;
  version: number;
  is_locked: boolean;
};
export type TaskCardGroupMember = {
  id: string;
  task_group_id: string;
  task_group_position: number;
  updated_at: string;
};
export type TaskCardTask = Omit<TaskWithGoal, "photos"> & {
  photos: TaskCardPhoto[];
  linkedBlocks: TaskCardLinkedBlock[];
};

const TASK_ID_BATCH_SIZE = 100;
const RESULT_PAGE_SIZE = 1000;

/** Load canonical card assets and ordering from the database; no client cache is authoritative. */
export async function getTaskCardData(tasks: TaskWithGoal[]) {
  const taskIds = [...new Set(tasks.map((task) => task.id))];
  const supabase = await createServerSupabase();
  const { data: groupRows, error: groupError } = await supabase
    .from("task_groups")
    .select("*")
    .order("position")
    .order("created_at");
  if (groupError) {
    console.error("[task-cards] card assets query failed", { code: groupError.code });
    throw new QueryError("tasks.getTaskCardData", groupError.code);
  }

  const photos: { id: string; task_id: string; path: string; sort_order: number }[] = [];
  const pendingPhotos: TaskCardPendingPhoto[] = [];
  const rawLinkedBlocks: Omit<TaskCardLinkedBlock, "occurrence_date">[] = [];
  for (let taskOffset = 0; taskOffset < taskIds.length; taskOffset += TASK_ID_BATCH_SIZE) {
    const taskBatch = taskIds.slice(taskOffset, taskOffset + TASK_ID_BATCH_SIZE);
    for (let rowOffset = 0; ; rowOffset += RESULT_PAGE_SIZE) {
      const [photoResult, reservationResult, blockResult] = await Promise.all([
        supabase
          .from("task_photos")
          .select("id, task_id, path, sort_order")
          .in("task_id", taskBatch)
          .order("sort_order")
          .order("created_at")
          .order("id")
          .range(rowOffset, rowOffset + RESULT_PAGE_SIZE - 1),
        supabase
          .from("task_photo_reservations")
          .select("task_id, operation_id, path, sort_order, status, failure_code")
          .in("task_id", taskBatch)
          .in("status", ["reserved", "failed"])
          .order("sort_order")
          .order("created_at")
          .order("operation_id")
          .range(rowOffset, rowOffset + RESULT_PAGE_SIZE - 1),
        supabase
          .from("time_blocks")
          .select("id, task_id, task_occurrence_id, start_at, end_at, version, is_locked")
          .in("task_id", taskBatch)
          .in("data_origin", [...COUNTED_DATA_ORIGINS])
          .eq("status", "active")
          .order("start_at")
          .order("id")
          .range(rowOffset, rowOffset + RESULT_PAGE_SIZE - 1),
      ]);
      const queryError = photoResult.error ?? reservationResult.error ?? blockResult.error;
      if (queryError) {
        console.error("[task-cards] card asset query failed", { code: queryError.code });
        throw new QueryError("tasks.getTaskCardData", queryError.code);
      }
      const photoPage = photoResult.data ?? [];
      const reservationPage = reservationResult.data ?? [];
      const blockPage = blockResult.data ?? [];
      photos.push(...photoPage);
      pendingPhotos.push(...(reservationPage as TaskCardPendingPhoto[]));
      for (const block of blockPage) {
        // Supabase's generated relationship type allows null here, although
        // this query is restricted to the task IDs above.
        if (block.task_id) rawLinkedBlocks.push({ ...block, task_id: block.task_id });
      }
      if (
        photoPage.length < RESULT_PAGE_SIZE &&
        reservationPage.length < RESULT_PAGE_SIZE &&
        blockPage.length < RESULT_PAGE_SIZE
      )
        break;
    }
  }

  const occurrenceIds = [
    ...new Set(
      rawLinkedBlocks.flatMap((block) =>
        block.task_occurrence_id ? [block.task_occurrence_id] : [],
      ),
    ),
  ];
  const occurrenceDates = new Map<string, string>();
  for (let offset = 0; offset < occurrenceIds.length; offset += 500) {
    const { data, error } = await supabase
      .from("task_occurrences")
      .select("id, occurrence_date")
      .in("id", occurrenceIds.slice(offset, offset + 500));
    if (error) {
      console.error("[task-cards] linked occurrence query failed", { code: error.code });
      throw new QueryError("tasks.getTaskCardData", error.code);
    }
    for (const occurrence of data ?? [])
      occurrenceDates.set(occurrence.id, occurrence.occurrence_date);
  }
  const linkedBlocksByTask = new Map<string, TaskCardLinkedBlock[]>();
  for (const block of rawLinkedBlocks) {
    const current = linkedBlocksByTask.get(block.task_id) ?? [];
    current.push({
      ...block,
      occurrence_date: block.task_occurrence_id
        ? (occurrenceDates.get(block.task_occurrence_id) ?? null)
        : null,
    });
    linkedBlocksByTask.set(block.task_id, current);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedUrls = user
    ? await signPhotoUrls(
        supabase,
        user.id,
        photos.map((photo) => photo.path),
      )
    : new Map<string, string | null>();
  const photosByTask = new Map<string, TaskCardPhoto[]>();
  for (const photo of photos) {
    const next = photosByTask.get(photo.task_id) ?? [];
    next.push({ ...photo, url: signedUrls.get(photo.path) ?? null });
    photosByTask.set(photo.task_id, next);
  }

  const groupIds = (groupRows ?? []).map((group) => group.id);
  const groupMembers: TaskCardGroupMember[] = [];
  if (groupIds.length > 0) {
    // Read every member, including off-screen tasks, so group mutations can
    // compare the complete affected membership snapshot.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, task_group_id, task_group_position, updated_at")
        .in("task_group_id", groupIds)
        .order("id")
        .range(offset, offset + 999);
      if (error) {
        console.error("[task-cards] group membership query failed", { code: error.code });
        throw new QueryError("tasks.getTaskCardData", error.code);
      }
      const rows = (data ?? []) as TaskCardGroupMember[];
      groupMembers.push(...rows);
      if (rows.length < 1000) break;
    }
  }

  return {
    tasks: tasks.map((task) => ({
      ...task,
      photos: photosByTask.get(task.id) ?? [],
      linkedBlocks: linkedBlocksByTask.get(task.id) ?? [],
    })),
    groups: (groupRows ?? []) as TaskCardGroup[],
    groupMembers,
    pendingPhotos,
  };
}
