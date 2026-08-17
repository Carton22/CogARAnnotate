export const DEFAULT_ANNOTATION_SHEET_SYNC_URL =
  "https://script.google.com/macros/s/AKfycbyfxUg6mQ8Qb2UqhUkmnJz_MvTmB1TxKAxeht2-RFZN9GD4mvZr2wDv7ZMyqzLYb5Rc/exec";

export async function publishAnnotations(
  rows,
  sheetSyncUrl,
  fetchImpl = globalThis.fetch,
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No annotation rows to sync.");
  }

  const url = String(sheetSyncUrl ?? "").trim();
  if (!url) {
    throw new Error("Google Sheets sync URL is required.");
  }

  const sheetRows = rows.map((row) => ({
    ...row,
    trust_in_ai: row.trust_in_ai ?? row.confidence ?? "",
    task_planning_score:
      row.task_planning_score ?? row.task_planning_engagement ?? "",
  }));

  await fetchImpl(url, {
    method: "POST",
    mode: "no-cors",
    credentials: "include",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      source: "cogar-annotation-console",
      type: "annotations",
      rows: sheetRows,
    }),
  });
}
