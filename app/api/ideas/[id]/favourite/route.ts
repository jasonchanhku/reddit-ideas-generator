import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const env = getServerEnv();

  const mongodbUri = env.mongodbUri;
  if (!mongodbUri) {
    return NextResponse.json({ error: "MongoDB not configured." }, { status: 503 });
  }

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid run ID." }, { status: 400 });
  }

  let body: { idea_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { idea_id } = body;
  if (!idea_id || typeof idea_id !== "string") {
    return NextResponse.json({ error: "idea_id is required." }, { status: 400 });
  }

  try {
    const db = await getDb(mongodbUri, env.mongodbDbName);
    const collection = env.mongodbCollection;

    const doc = await db.collection(collection).findOne(
      { _id: new ObjectId(id), "ideas.idea_id": idea_id },
      { projection: { "ideas.$": 1 } },
    );

    if (!doc) {
      return NextResponse.json(
        { error: "Idea not found. It may be from a legacy run without idea_id." },
        { status: 404 },
      );
    }

    const current = (doc.ideas[0] as { is_favourite?: boolean } | undefined)?.is_favourite ?? false;
    const newValue = !current;

    await db.collection(collection).updateOne(
      { _id: new ObjectId(id), "ideas.idea_id": idea_id },
      { $set: { "ideas.$.is_favourite": newValue } },
    );

    return NextResponse.json({ is_favourite: newValue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
