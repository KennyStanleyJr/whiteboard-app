import type { WhiteboardElement } from "@/types/whiteboard";

/**
 * Generate a unique element ID that is not in the given set.
 * Format matches WhiteboardCanvas (el-timestamp-random) for consistency.
 */
function generateUniqueElementId(usedIds: Set<string>): string {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i += 1) {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
  const fallbackId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 15)}-${Math.random().toString(36).slice(2, 9)}`;
  usedIds.add(fallbackId);
  return fallbackId;
}

/**
 * Remap element IDs so they do not collide with existing IDs.
 * Use when appending uploaded elements to a board so all existing and
 * appended elements are kept (no overwrite by duplicate id).
 *
 * @param existingIds - IDs already on the board
 * @param elements - Incoming elements (e.g. from uploaded file)
 * @returns New array of elements with unique IDs; order preserved
 */
export function remapElementIdsForAppend(
  existingIds: Set<string>,
  elements: WhiteboardElement[]
): WhiteboardElement[] {
  const usedIds = new Set(existingIds);
  return elements.map((el) => {
    const newId = generateUniqueElementId(usedIds);
    return { ...el, id: newId };
  });
}
