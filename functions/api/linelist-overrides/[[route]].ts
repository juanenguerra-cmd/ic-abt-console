interface Env {
  DB: D1Database;
}

interface OverrideRow {
  row_index: number;
  col_key: string;
  value: string;
}

interface PostBody {
  outbreakId: string;
  facilityId: string;
  template: string;
  rowIndex: number;
  colKey: string;
  value: string;
}

interface DeleteBody {
  outbreakId: string;
  template: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: JSON_HEADERS,
  });
}

function serverError(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: JSON_HEADERS,
  });
}

function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const outbreakId = url.searchParams.get("outbreakId");
  const template = url.searchParams.get("template");

  if (!outbreakId || !template) {
    return badRequest("outbreakId and template are required");
  }

  try {
    const result = await context.env.DB.prepare(
      "SELECT row_index, col_key, value FROM linelist_report_overrides WHERE outbreak_id = ? AND template = ?"
    )
      .bind(outbreakId, template)
      .all<OverrideRow>();

    const overrides: Record<string, string> = {};
    for (const row of result.results) {
      overrides[`${row.row_index}::${row.col_key}`] = row.value;
    }

    return ok({ overrides });
  } catch (err) {
    console.error("GET linelist-overrides error:", err);
    return serverError("Failed to fetch overrides");
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: PostBody;
  try {
    body = await context.request.json<PostBody>();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { outbreakId, facilityId, template, rowIndex, colKey, value } = body;
  if (!outbreakId || !facilityId || !template || rowIndex === undefined || !colKey) {
    return badRequest("outbreakId, facilityId, template, rowIndex, and colKey are required");
  }

  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();

  try {
    await context.env.DB.prepare(
      `INSERT INTO linelist_report_overrides
         (id, facility_id, outbreak_id, template, row_index, col_key, value, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(outbreak_id, template, row_index, col_key)
       DO UPDATE SET
         value      = excluded.value,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`
    )
      .bind(id, facilityId, outbreakId, template, rowIndex, colKey, value ?? "", null, updatedAt)
      .run();

    return ok({ success: true });
  } catch (err) {
    console.error("POST linelist-overrides error:", err);
    return serverError("Failed to save override");
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  let body: DeleteBody;
  try {
    body = await context.request.json<DeleteBody>();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { outbreakId, template } = body;
  if (!outbreakId || !template) {
    return badRequest("outbreakId and template are required");
  }

  try {
    await context.env.DB.prepare(
      "DELETE FROM linelist_report_overrides WHERE outbreak_id = ? AND template = ?"
    )
      .bind(outbreakId, template)
      .run();

    return ok({ success: true });
  } catch (err) {
    console.error("DELETE linelist-overrides error:", err);
    return serverError("Failed to delete overrides");
  }
};
