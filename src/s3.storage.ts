import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerS3 = require('multer-s3');

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

const bucket = () => process.env.AWS_S3_BUCKET || 'expedited-transport-uploads';

export function createS3Storage(folder: string) {
  return multerS3({
    s3: getS3(),
    bucket: bucket(),
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req: any, file: Express.Multer.File, cb: (err: any, key: string) => void) => {
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${folder}/${name}${extname(file.originalname || '') || '.jpg'}`);
    },
  });
}

export async function uploadBufferToS3(
  folder: string,
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Promise<string> {
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const key = `${folder}/${name}${extname(originalname || '') || '.jpg'}`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'image/jpeg',
    }),
  );
  return `https://${bucket()}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export async function deleteS3File(urlOrKey: string): Promise<void> {
  try {
    const key = urlOrKey.startsWith('https://') ? new URL(urlOrKey).pathname.slice(1) : urlOrKey;
    await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch { /* ignore */ }
}

export interface S3File extends Express.Multer.File {
  location: string;
  key: string;
}
