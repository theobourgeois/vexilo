// Not a "use server" file: everything exported from one of those can be called from the browser,
// and these take any bucket key. Server code calls them after its own checks.
import { getServerAuthSession } from "@/lib/auth";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { CLOUD_FRONT_URL } from "@/lib/constant";
import { IMAGE_EXTENSIONS, UnsafeImageError, safeImageBody } from "@/lib/storage/safe-image";

export { UnsafeImageError };

const bucketName = process.env.S3_BUCKET_NAME!;

const s3Client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export const uploadFile = async (
  file: string | Buffer,
  bucketName: string,
  key: string,
  contentType: string
) => {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  const uploadParams = {
    Bucket: bucketName,
    Key: key,
    Body: safeImageBody(file, contentType),
    ContentType: contentType,
  };

  const command = new PutObjectCommand(uploadParams);
  const response = await s3Client.send(command);

  return response;
};

export async function deleteFileFromUrl(url: string) {
  const key = url.replace(`${CLOUD_FRONT_URL}/`, "");
  if (!key) {
    throw new Error("Invalid URL");
  }
  await deleteFile(key);
}

export async function deleteFile(key: string) {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await s3Client.send(command);
}

export async function base64ImageToS3URI(base64Image: string): Promise<string> {
  // Extract the content type and base64 data
  const [header, base64Data] = base64Image.split(',');
  if (!header || !base64Data) {
    throw new Error('Invalid base64 image data');
  }

  const contentType = header.split(':')[1]?.split(';')[0]?.trim().toLowerCase() ?? '';
  const imageBuffer = Buffer.from(base64Data, 'base64');
  const fileExtension = IMAGE_EXTENSIONS[contentType];
  if (!fileExtension) {
    throw new UnsafeImageError("That file type isn't supported.");
  }
  const fileName = `images/${crypto.randomUUID()}.${fileExtension}`;

  await uploadFile(imageBuffer, bucketName, fileName, contentType);

  return `${CLOUD_FRONT_URL}/${fileName}`;
}
