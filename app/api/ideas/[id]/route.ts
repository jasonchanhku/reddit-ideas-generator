import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const env = getServerEnv();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Idea ID is required." }, { status: 400 });
  }

  if (!env.mongodbUri) {
    return NextResponse.json({ error: "Persistence not configured." }, { status: 503 });
  }

  try {
    const db = await getDb(env.mongodbUri, env.mongodbDbName);
    const result = await db
      .collection(env.mongodbCollection)
      .aggregate([
        { $unwind: "$ideas" },
        { $match: { "ideas.idea_id": id } },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$ideas", { run_id: { $toString: "$_id" } }],
            },
          },
        },
        { $limit: 1 },
      ])
      .toArray();

    if (result.length === 0) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    return NextResponse.json({
      idea: result[0],
      research_enabled: Boolean(env.serphApiKey),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch idea.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
