import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { TEMP_CHUNKS_DIR, UPLOADS_DIR, initStorageDirectories } from '../config';

export class StorageService {
  /**
   * Streams incoming HTTP chunk stream directly to disk without loading into memory.
   * Simultaneously calculates the chunk's SHA-256 hash.
   */
  static async saveChunkStream(
    uploadId: string,
    partIndex: number,
    inputStream: NodeJS.ReadableStream
  ): Promise<{ size: number; hash: string }> {
    initStorageDirectories();
    const uploadTempDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadTempDir)) {
      fs.mkdirSync(uploadTempDir, { recursive: true });
    }

    const chunkPath = path.join(uploadTempDir, `${partIndex}.chunk`);
    const tempChunkPath = `${chunkPath}.tmp`;

    const writeStream = fs.createWriteStream(tempChunkPath);
    const hash = crypto.createHash('sha256');

    let bytesReceived = 0;

    // Wrap in promise to process stream with backpressure
    await new Promise<void>((resolve, reject) => {
      inputStream.on('data', (chunk: Buffer) => {
        bytesReceived += chunk.length;
        hash.update(chunk);
        const canWrite = writeStream.write(chunk);
        if (!canWrite) {
          inputStream.pause();
          writeStream.once('drain', () => inputStream.resume());
        }
      });

      inputStream.on('end', () => {
        writeStream.end(() => {
          fs.renameSync(tempChunkPath, chunkPath);
          resolve();
        });
      });

      inputStream.on('error', (err) => {
        writeStream.destroy();
        if (fs.existsSync(tempChunkPath)) {
          fs.unlinkSync(tempChunkPath);
        }
        reject(err);
      });

      writeStream.on('error', (err) => {
        if (typeof (inputStream as any).destroy === 'function') {
          (inputStream as any).destroy();
        }
        if (fs.existsSync(tempChunkPath)) {
          fs.unlinkSync(tempChunkPath);
        }
        reject(err);
      });
    });

    const chunkHash = hash.digest('hex');
    return {
      size: bytesReceived,
      hash: chunkHash,
    };
  }

  /**
   * Returns a list of part indexes that have already been completely saved on disk.
   */
  static getUploadedPartIndexes(uploadId: string): number[] {
    const uploadTempDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadTempDir)) {
      return [];
    }

    const files = fs.readdirSync(uploadTempDir);
    const parts: number[] = [];

    for (const file of files) {
      if (file.endsWith('.chunk')) {
        const partNum = parseInt(file.replace('.chunk', ''), 10);
        if (!isNaN(partNum)) {
          parts.push(partNum);
        }
      }
    }

    return parts.sort((a, b) => a - b);
  }

  /**
   * Sequentially stitches 5MB chunks together into final assembled file.
   * Computes the overall SHA-256 hash using streaming and cleans up temporary chunk files.
   */
  static async assembleChunks(
    uploadId: string,
    totalChunks: number,
    originalName: string
  ): Promise<{ assembledPath: string; totalSize: number; sha256: string }> {
    initStorageDirectories();
    const ext = path.extname(originalName) || '.mp4';
    const assembledPath = path.join(UPLOADS_DIR, `${uploadId}${ext}`);
    const uploadTempDir = path.join(TEMP_CHUNKS_DIR, uploadId);

    const outStream = fs.createWriteStream(assembledPath);
    const overallHash = crypto.createHash('sha256');
    let totalSize = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(uploadTempDir, `${i}.chunk`);
      if (!fs.existsSync(chunkPath)) {
        outStream.destroy();
        throw new Error(`Missing chunk part ${i} during assembly.`);
      }

      await new Promise<void>((resolve, reject) => {
        const inStream = fs.createReadStream(chunkPath);

        inStream.on('data', (data: Buffer | string) => {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          totalSize += buf.length;
          overallHash.update(buf);
          const canWrite = outStream.write(buf);
          if (!canWrite) {
            inStream.pause();
            outStream.once('drain', () => inStream.resume());
          }
        });

        inStream.on('end', () => resolve());
        inStream.on('error', (err) => reject(err));
      });
    }

    await new Promise<void>((resolve) => {
      outStream.end(() => resolve());
    });

    const finalSha256 = overallHash.digest('hex');

    // Clean up temporary chunks directory
    try {
      fs.rmSync(uploadTempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(`[Storage] Failed to cleanup chunks dir for ${uploadId}:`, cleanupErr);
    }

    return {
      assembledPath,
      totalSize,
      sha256: finalSha256,
    };
  }
}
