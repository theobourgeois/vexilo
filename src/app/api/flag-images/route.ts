import { uploadFile } from "@/actions/s3";
import { getServerAuthSession } from "@/lib/auth";
import { MAX_FLAG_IMAGE_BYTES } from "@/lib/batch-flags";
import { CLOUD_FRONT_URL } from "@/lib/constant";
import { NextResponse } from "next/server";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json(
      { message: "You must be logged in to upload flags." },
      { status: 401 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No image provided." }, { status: 400 });
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[file.type];
  if (!extension) {
    return NextResponse.json(
      { message: "Only SVG, PNG, JPG, GIF, WebP or AVIF images are supported." },
      { status: 415 },
    );
  }

  if (file.size > MAX_FLAG_IMAGE_BYTES) {
    return NextResponse.json(
      { message: "Image is too large (4 MB max)." },
      { status: 413 },
    );
  }

  const key = `images/${crypto.randomUUID()}.${extension}`;
  await uploadFile(
    Buffer.from(await file.arrayBuffer()),
    process.env.S3_BUCKET_NAME!,
    key,
    file.type,
  );

  return NextResponse.json({ url: `${CLOUD_FRONT_URL}/${key}` });
}
