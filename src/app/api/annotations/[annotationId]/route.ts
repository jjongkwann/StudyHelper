import { NextRequest, NextResponse } from "next/server";
import { annotationService } from "@/application/annotation/service";

const VALID_COLORS = new Set(["yellow", "blue", "green", "pink"]);
const MAX_NOTE_LENGTH = 5000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;
  const body = await request.json();
  const { note, color } = body;

  if (note !== undefined && typeof note === "string" && note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `note must be ${MAX_NOTE_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  if (color !== undefined && !VALID_COLORS.has(color)) {
    return NextResponse.json(
      { error: `color must be one of: ${[...VALID_COLORS].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const updated = await annotationService.update(annotationId, {
      note: typeof note === "string" ? note.trim() : undefined,
      color: color || undefined,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;

  try {
    await annotationService.delete(annotationId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }
}
