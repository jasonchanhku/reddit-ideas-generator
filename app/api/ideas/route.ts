import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const env = getServerEnv();
  const { searchParams } = new URL(request.url);
  const isFavourite = searchParams.get("is_favourite");

  if (!env.mongodbUri) {
    return NextResponse.json({ ideas: [] });
  }

  try {
    const db = await getDb(env.mongodbUri, env.mongodbDbName);

    const matchFilter: Record<string, unknown> =
      isFavourite === "true" ? { "ideas.is_favourite": true } : {};

    const ideas = await db
      .collection(env.mongodbCollection)
      .aggregate([
        { $unwind: "$ideas" },
        { $match: matchFilter },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$ideas", { run_id: { $toString: "$_id" } }],
            },
          },
        },
        { $sort: { score: -1 } },
      ])
      .toArray();

    return NextResponse.json({ ideas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ideas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
