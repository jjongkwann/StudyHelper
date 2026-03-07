import { NextRequest, NextResponse } from "next/server";
import { annotationService } from "@/application/annotation/service";

const VALID_COLORS = new Set(["yellow", "blue", "green", "pink"]);
const MAX_TEXT_LENGTH = 2000;
const MAX_NOTE_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conceptId, selectedText, note, color } = body;

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

  const annotation = await annotationService.create({
    conceptId,
    selectedText: selectedText.trim(),
    note: typeof note === "string" ? note.trim() || undefined : undefined,
    color: color || undefined,
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
