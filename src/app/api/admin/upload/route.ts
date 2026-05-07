import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getAdminSession } from "@/lib/admin-auth";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const ALLOWED_CATEGORIES = new Set([
  "vehicles",
  "brands",
  "reviews",
  "trims",
  "colors",
  "misc",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const categoryRaw = formData.get("category");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "파일이 첨부되지 않았습니다." },
        { status: 400 }
      );
    }

    const category =
      typeof categoryRaw === "string" && categoryRaw.length > 0
        ? categoryRaw
        : "vehicles";

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "허용되지 않은 카테고리입니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 5MB를 초과할 수 없습니다." },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "빈 파일은 업로드할 수 없습니다." },
        { status: 400 }
      );
    }

    const mime = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return NextResponse.json(
        { error: "이미지 파일(jpg, png, webp, gif)만 업로드할 수 있습니다." },
        { status: 415 }
      );
    }

    const rawExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json(
        { error: "허용되지 않은 파일 확장자입니다." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadDir = path.join(process.cwd(), "public", "images", category);
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = MIME_TO_EXT[mime] ?? rawExt;
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    const url = `/images/${category}/${filename}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[POST /api/admin/upload]", error);
    return NextResponse.json(
      { error: "업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
