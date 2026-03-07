import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { dirname, join, resolve } from "path";

function sanitizeRelativePath(input: string) {
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("유효하지 않은 파일 경로가 포함되어 있습니다.");
  }
  return normalized;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files");
  const paths = formData.getAll("paths");

  if (files.length === 0 || paths.length === 0 || files.length !== paths.length) {
    return NextResponse.json(
      { error: "업로드할 폴더 파일을 찾지 못했습니다." },
      { status: 400 }
    );
  }

  const uploadRoot = join("/tmp", "studyhelper-imports", randomUUID());
  await mkdir(uploadRoot, { recursive: true });

  let markdownCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index];
    const pathEntry = paths[index];

    if (!(entry instanceof File) || typeof pathEntry !== "string") {
      return NextResponse.json(
        { error: "업로드 데이터 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const relativePath = sanitizeRelativePath(pathEntry);
    const destination = resolve(uploadRoot, relativePath);
    if (!destination.startsWith(uploadRoot)) {
      return NextResponse.json(
        { error: "허용되지 않는 파일 경로가 포함되어 있습니다." },
        { status: 400 }
      );
    }

    await mkdir(dirname(destination), { recursive: true });
    const bytes = Buffer.from(await entry.arrayBuffer());
    await writeFile(destination, bytes);

    if (relativePath.toLowerCase().endsWith(".md")) {
      markdownCount += 1;
    }
  }

  if (markdownCount === 0) {
    return NextResponse.json(
      { error: "선택한 폴더에 마크다운 파일(.md)이 없습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    contentPath: uploadRoot,
    markdownCount,
  });
}
