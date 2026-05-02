import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { Transform } from 'stream';

export interface WorkerInput {
  filePath: string;
  algorithm: 'brotli' | 'gzip' | 'zstd';
  quality: number;
  gzipLevel: number;
  zstdLevel: number;
  verifyIntegrity: boolean;
}

export interface WorkerOutput {
  compressedPath: string;
  compressedSize: number;
  hash?: string;
  algorithm: 'brotli' | 'gzip' | 'zstd';
}

function createHashTransform(hashInstance: crypto.Hash): Transform {
  return new Transform({
    transform(chunk, _encoding, callback) {
      hashInstance.update(chunk);
      this.push(chunk);
      callback();
    },
  });
}

function compressWithStream(
  filePath: string,
  compressedPath: string,
  compressStream: NodeJS.ReadWriteStream,
  verifyIntegrity: boolean
): Promise<{ compressedSize: number; hash?: string }> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(compressedPath);

    let writeHash: crypto.Hash | undefined;
    if (verifyIntegrity) {
      writeHash = crypto.createHash('sha256');
      const hashTransform = createHashTransform(writeHash);
      readStream.pipe(compressStream).pipe(hashTransform).pipe(writeStream);
    } else {
      readStream.pipe(compressStream).pipe(writeStream);
    }

    writeStream.on('finish', () => {
      try {
        const compressedSize = fs.statSync(compressedPath).size;
        const hash = writeHash ? writeHash.digest('hex') : undefined;
        resolve({ compressedSize, hash });
      } catch (error) {
        reject(error);
      }
    });

    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
}

async function compressZstdBuffer(
  filePath: string,
  compressedPath: string,
  level: number,
  verifyIntegrity: boolean
): Promise<{ compressedSize: number; hash?: string }> {
  const mod = await import('@mongodb-js/zstd');
  const compressFn = mod.compress || (mod.default && mod.default.compress);
  const input = fs.readFileSync(filePath);
  const compressed = await compressFn(Buffer.from(input), level);
  fs.writeFileSync(compressedPath, compressed);

  const compressedSize = fs.statSync(compressedPath).size;
  let hash: string | undefined;
  if (verifyIntegrity) {
    hash = crypto.createHash('sha256').update(compressed).digest('hex');
  }
  return { compressedSize, hash };
}

export default async function compress(input: WorkerInput): Promise<WorkerOutput> {
  const { filePath, algorithm, quality, gzipLevel, zstdLevel, verifyIntegrity } = input;

  let result: { compressedSize: number; hash?: string };
  let compressedPath: string;

  switch (algorithm) {
    case 'brotli': {
      compressedPath = `${filePath}.br`;
      const stream = zlib.createBrotliCompress({
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(Math.max(quality, 0), 11) },
      });
      result = await compressWithStream(filePath, compressedPath, stream, verifyIntegrity);
      break;
    }
    case 'gzip': {
      compressedPath = `${filePath}.gz`;
      const stream = zlib.createGzip({
        level: Math.min(Math.max(gzipLevel, 0), 9),
      });
      result = await compressWithStream(filePath, compressedPath, stream, verifyIntegrity);
      break;
    }
    case 'zstd': {
      compressedPath = `${filePath}.zst`;
      const level = Math.min(Math.max(zstdLevel, 1), 22);
      let hasNative = false;
      if (typeof (zlib as any).createZstdCompress === 'function') {
        try { (zlib as any).createZstdCompress(); hasNative = true; } catch { /* unavailable */ }
      }
      if (hasNative) {
        const stream = (zlib as any).createZstdCompress({
          params: { [zlib.constants.ZSTD_c_compressionLevel]: level },
        });
        result = await compressWithStream(filePath, compressedPath, stream, verifyIntegrity);
      } else {
        result = await compressZstdBuffer(filePath, compressedPath, level, verifyIntegrity);
      }
      break;
    }
  }

  return {
    compressedPath,
    compressedSize: result.compressedSize,
    hash: result.hash,
    algorithm,
  };
}
