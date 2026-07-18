import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { generatePRD } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { SaasIdea } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    if (idea.stage !== "poc") {
      return NextResponse.json(
        { error: "Idea must be in the PoC stage to generate a PRD." },
        { status: 409 },
      );
    }

    const prdContent = await generatePRD(idea);

    await collection.updateOne(
      { _id: doc._id, "ideas.idea_id": id },
      { $set: { "ideas.$.prd_content": prdContent } },
    );

    return NextResponse.json({
      idea: {
        ...idea,
        prd_content: prdContent,
        run_id: runId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PRD generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
