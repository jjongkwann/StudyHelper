import { NextRequest, NextResponse } from "next/server";
import { userNoteService } from "@/application/user-note/service";

const MAX_SUMMARY_LENGTH = 10000;

export async function GET(request: NextRequest) {
  const conceptId = new URL(request.url).searchParams.get("conceptId");
  if (!conceptId) {
    return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
  }
  const note = await userNoteService.get(conceptId);
  return NextResponse.json(note);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { conceptId, userSummary } = body;

  if (!conceptId || typeof userSummary !== "string") {
    return NextResponse.json(
      { error: "conceptId and userSummary are required" },
      { status: 400 }
    );
  }

  if (userSummary.length > MAX_SUMMARY_LENGTH) {
    return NextResponse.json(
      { error: `userSummary must be ${MAX_SUMMARY_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  const result = await userNoteService.save(conceptId, userSummary);
  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const conceptId = new URL(request.url).searchParams.get("conceptId");
  if (!conceptId) {
    return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
  }
  await userNoteService.delete(conceptId);
  return NextResponse.json({ ok: true });
}
