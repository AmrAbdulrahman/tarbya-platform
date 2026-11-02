import { Injectable } from '@nestjs/common';
import { PrismaService } from '@tarbya/db';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AppException } from '../../common/app-exception';
import { StorageService } from './storage.service';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);
const SIZE = 256;

/** Profile pictures (US-2.1): JPEG/PNG/WebP up to 5 MB, stored as a 256px WebP square. */
@Injectable()
export class AvatarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Where the web loads a user's picture; the file id busts caches when it changes. */
  static url(userId: string, fileId: string | null): string | null {
    return fileId ? `/api/files/avatars/${userId}?v=${fileId}` : null;
  }

  async set(userId: string, upload: Buffer): Promise<void> {
    // Trust the bytes, not the declared type.
    const meta = await sharp(upload)
      .metadata()
      .catch(() => undefined);
    if (!meta?.format || !ACCEPTED.has(meta.format)) {
      throw new AppException(400, {
        code: 'FILE_TYPE',
        title: 'Use a JPEG, PNG or WebP image',
      });
    }
    const image = await sharp(upload)
      .rotate()
      .resize(SIZE, SIZE, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
    const key = `avatars/${userId}/${randomUUID()}.webp`;
    await this.storage.put(key, image, 'image/webp');

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarFile: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const file = await tx.fileObject.create({
        data: { key, mime: 'image/webp', size: image.length },
      });
      await tx.user.update({
        where: { id: userId },
        data: { avatarFileId: file.id },
      });
      if (previous?.avatarFile)
        await tx.fileObject.delete({ where: { id: previous.avatarFile.id } });
    });
    if (previous?.avatarFile)
      await this.storage.delete(previous.avatarFile.key).catch(() => undefined);
  }

  async remove(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarFile: true },
    });
    if (!user?.avatarFile) return;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { avatarFileId: null },
      }),
      this.prisma.fileObject.delete({ where: { id: user.avatarFile.id } }),
    ]);
    await this.storage.delete(user.avatarFile.key).catch(() => undefined);
  }

  async read(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarFile: true },
    });
    if (!user?.avatarFile)
      throw new AppException(404, { code: 'NOT_FOUND', title: 'No picture' });
    return {
      stream: await this.storage.get(user.avatarFile.key),
      mime: user.avatarFile.mime,
    };
  }
}
