import { NextRequest, NextResponse } from "next/server";
import { annotationService } from "@/application/annotation/service";

const VALID_COLORS = new Set(["yellow", "blue", "green", "pink"]);
const VALID_TYPES = new Set(["highlight", "memo"]);
const MAX_TEXT_LENGTH = 2000;
const MAX_NOTE_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conceptId, type, selectedText, note, color, startOffset, endOffset } = body;

  if (!conceptId || typeof selectedText !== "string" || !selectedText.trim()) {
    return NextResponse.json(
      { error: "conceptId and selectedText are required" },
      { status: 400 }
    );
  }

  if (selectedText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `selectedText must be ${MAX_TEXT_LENGTH} characters or less` },
      { status: 400 }
    );
  }

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

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  if (
    (startOffset !== undefined && (!Number.isInteger(startOffset) || startOffset < 0)) ||
    (endOffset !== undefined && (!Number.isInteger(endOffset) || endOffset < 0))
  ) {
    return NextResponse.json(
      { error: "startOffset and endOffset must be non-negative integers" },
      { status: 400 }
    );
  }

  if (
    startOffset !== undefined &&
    endOffset !== undefined &&
    startOffset >= endOffset
  ) {
    return NextResponse.json(
      { error: "startOffset must be smaller than endOffset" },
      { status: 400 }
    );
  }

  const annotation = await annotationService.create({
    conceptId,
    type,
    selectedText: selectedText.trim(),
    note: typeof note === "string" ? note.trim() || undefined : undefined,
    color: color || undefined,
    startOffset: startOffset ?? undefined,
    endOffset: endOffset ?? undefined,
  });

  return NextResponse.json(annotation, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectSlug = searchParams.get("projectSlug");
  const conceptId = searchParams.get("conceptId");

  if (conceptId) {
    const annotations = await annotationService.listByConcept(conceptId);
    return NextResponse.json(annotations);
  }

  if (projectSlug) {
    const annotations = await annotationService.listByProject(projectSlug);
    return NextResponse.json(annotations);
  }

  return NextResponse.json(
    { error: "conceptId or projectSlug is required" },
    { status: 400 }
  );
}
