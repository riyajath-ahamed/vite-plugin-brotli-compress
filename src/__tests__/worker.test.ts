import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import brotliCompress, { CompressionType, CompressionStats } from '../index';

const zstdAvailable = await (async () => {
  const testBuf = Buffer.from('test');
  if (typeof (zlib as any).createZstdCompress === 'function') {
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = (zlib as any).createZstdCompress();
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => resolve());
        stream.on('error', reject);
        stream.end(testBuf);
      });
      return true;
    } catch { /* not usable */ }
  }
  try {
    const mod = await import('@mongodb-js/zstd');
    const fn = mod.compress || mod.default?.compress;
    await fn(testBuf, 3);
    return true;
  } catch { /* not usable */ }
  return false;
})();

function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-worker-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function createTestFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function compressibleContent(sizeMultiplier = 100): string {
  return 'console.log("Hello, World!"); '.repeat(sizeMultiplier);
}

describe('Worker Threads Compression', () => {
  let testDir: string;
  let mockConfig: any;

  beforeEach(() => {
    testDir = createTestDir();
    mockConfig = { build: { outDir: testDir } };
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should compress files with brotli using worker threads', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.BROTLI,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.brotliFiles).toBe(1);

    const originalSize = fs.statSync(path.join(testDir, 'app.js')).size;
    const compressedSize = fs.statSync(path.join(testDir, 'app.js.br')).size;
    expect(compressedSize).toBeLessThan(originalSize);
  });

  it('should compress files with gzip using worker threads', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.GZIP,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.gzipFiles).toBe(1);
  });

  it.skipIf(!zstdAvailable)('should compress files with zstd using worker threads', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.ZSTD,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.zst'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.zstdFiles).toBe(1);
  });

  it('should handle BOTH type with worker threads', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.BOTH,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(2);
    expect(receivedStats!.brotliFiles).toBe(1);
    expect(receivedStats!.gzipFiles).toBe(1);
  });

  it('should compress multiple files with worker threads', async () => {
    const content = compressibleContent(100);
    createTestFile(testDir, 'a.js', content);
    createTestFile(testDir, 'b.js', content);
    createTestFile(testDir, 'c.css', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js', 'css'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(3);
    expect(receivedStats!.totalFiles).toBe(3);
  });

  it('should work with verifyIntegrity and worker threads', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      verifyIntegrity: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.failedFiles).toBe(0);
  });

  it('should work with compressionThreshold and worker threads', async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let content = '';
    for (let i = 0; i < 3000; i++) {
      content += chars[(i * 7 + 13) % chars.length];
    }
    createTestFile(testDir, 'data.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      compressionThreshold: 0.99,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.skippedFiles).toBeGreaterThan(0);
    expect(receivedStats!.compressedFiles).toBe(0);
  });

  it('should produce identical results to main-thread compression', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let mainStats: CompressionStats | null = null;
    let workerStats: CompressionStats | null = null;

    // Main thread compression
    const mainPlugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: false,
      onComplete: (stats) => { mainStats = stats; },
    });
    (mainPlugin.configResolved as any)(mockConfig);
    await (mainPlugin.closeBundle as any)();

    const mainBrSize = fs.statSync(path.join(testDir, 'app.js.br')).size;

    // Clean up and recreate for worker test
    fs.unlinkSync(path.join(testDir, 'app.js.br'));
    createTestFile(testDir, 'app.js', content);

    // Worker thread compression
    const workerPlugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      onComplete: (stats) => { workerStats = stats; },
    });
    (workerPlugin.configResolved as any)(mockConfig);
    await (workerPlugin.closeBundle as any)();

    const workerBrSize = fs.statSync(path.join(testDir, 'app.js.br')).size;

    expect(mainStats).not.toBeNull();
    expect(workerStats).not.toBeNull();
    expect(mainStats!.compressedFiles).toBe(workerStats!.compressedFiles);
    expect(mainBrSize).toBe(workerBrSize);
  });

  it('should respect maxWorkerThreads option', async () => {
    const content = compressibleContent(100);
    for (let i = 0; i < 5; i++) {
      createTestFile(testDir, `file${i}.js`, content);
    }

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      useWorkerThreads: true,
      maxWorkerThreads: 2,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(fs.existsSync(path.join(testDir, `file${i}.js.br`))).toBe(true);
    }
  });
});
