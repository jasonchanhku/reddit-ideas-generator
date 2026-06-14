import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { RunDocument } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const env = getServerEnv();
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid run ID." }, { status: 400 });
  }

  if (!env.mongodbUri) {
    return NextResponse.json({ error: "Persistence not configured." }, { status: 503 });
  }

  try {
    const db = await getDb(env.mongodbUri, env.mongodbDbName);
    const doc = await db
      .collection(env.mongodbCollection)
      .findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const run: RunDocument = {
      _id: (doc._id as ObjectId).toString(),
      subreddits: doc.subreddits ?? [],
      focusModes: doc.focusModes ?? [],
      timeRange: doc.timeRange ?? null,
      ideas: doc.ideas ?? [],
      analyzed_at: doc.analyzed_at ?? "",
    };

    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch run.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const env = getServerEnv();
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid run ID." }, { status: 400 });
  }

  if (!env.mongodbUri) {
    return NextResponse.json({ error: "Persistence not configured." }, { status: 503 });
  }

  try {
    const db = await getDb(env.mongodbUri, env.mongodbDbName);
    const result = await db
      .collection(env.mongodbCollection)
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete run.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
