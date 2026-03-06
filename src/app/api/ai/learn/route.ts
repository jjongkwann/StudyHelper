import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function POST(request: Request) {
  const { conceptId } = await request.json();

  if (!conceptId) {
    return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
  }

  const result = await studyService.learn(conceptId);
  if (!result) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
