import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { SaasIdea } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
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
    const collection = db.collection(env.mongodbCollection);

    const doc = await collection.findOne(
      { "ideas.idea_id": id },
      { projection: { "ideas.$": 1 } },
    );

    if (!doc || !doc.ideas?.[0]) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    const idea = doc.ideas[0] as SaasIdea;
    const runId = (doc._id as ObjectId).toString();

    if (idea.stage !== "researched") {
      return NextResponse.json(
        { error: "Idea must complete research before moving to PoC." },
        { status: 409 },
      );
    }

    await collection.updateOne(
      { _id: doc._id, "ideas.idea_id": id },
      { $set: { "ideas.$.stage": "poc" } },
    );

    return NextResponse.json({
      idea: {
        ...idea,
        stage: "poc",
        run_id: runId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move idea to PoC.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
