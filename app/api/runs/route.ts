import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { RunSummary } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const env = getServerEnv();

  if (!env.mongodbUri) {
    return NextResponse.json({ runs: [] });
  }

  try {
    const db = await getDb(env.mongodbUri, env.mongodbDbName);

    const docs = await db
      .collection(env.mongodbCollection)
      .find(
        {},
        {
          projection: {
            _id: 1,
            subreddits: 1,
            focusModes: 1,
            timeRange: 1,
            analyzed_at: 1,
          },
        },
      )
      .sort({ analyzed_at: -1 })
      .limit(50)
      .toArray();

    const runs: RunSummary[] = docs.map((doc) => ({
      _id: (doc._id as ObjectId).toString(),
      subreddits: doc.subreddits ?? [],
      focusModes: doc.focusModes ?? [],
      timeRange: doc.timeRange ?? null,
      analyzed_at: doc.analyzed_at ?? "",
    }));

    return NextResponse.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch runs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
