import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import brotliCompress, { CompressionType, CompressionStats, ZstdLevel } from '../index';

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
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-zstd-${Date.now()}`);
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

describe('Zstd Compression Support', () => {
  let testDir: string;
  let mockConfig: any;

  beforeEach(() => {
    testDir = createTestDir();
    mockConfig = { build: { outDir: testDir } };
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('plugin creation', () => {
    it('should create a plugin with CompressionType.ZSTD', () => {
      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        verbose: false,
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });

    it('should accept zstdLevel option', () => {
      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        zstdLevel: ZstdLevel.HIGH,
        verbose: false,
      });

      expect(plugin).toBeDefined();
    });
  });

  describe('ZstdLevel enum', () => {
    it('should have correct level values', () => {
      expect(ZstdLevel.FASTEST).toBe(1);
      expect(ZstdLevel.DEFAULT).toBe(3);
      expect(ZstdLevel.HIGH).toBe(9);
      expect(ZstdLevel.VERY_HIGH).toBe(15);
      expect(ZstdLevel.MAXIMUM).toBe(22);
    });
  });

  describe('compression', () => {
    it.skipIf(!zstdAvailable)('should produce .zst files smaller than originals', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const zstPath = path.join(testDir, 'app.js.zst');
      expect(fs.existsSync(zstPath)).toBe(true);

      const originalSize = fs.statSync(path.join(testDir, 'app.js')).size;
      const compressedSize = fs.statSync(zstPath).size;
      expect(compressedSize).toBeLessThan(originalSize);
      expect(compressedSize).toBeGreaterThan(0);
    });

    it.skipIf(!zstdAvailable)('should compress multiple files', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'a.js', content);
      createTestFile(testDir, 'b.css', content);

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js', 'css'],
        verbose: false,
        minSize: 0,
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'a.js.zst'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'b.css.zst'))).toBe(true);
    });

    it.skipIf(!zstdAvailable)('should report correct stats via onComplete', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onComplete: (stats) => { receivedStats = stats; },
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.compressedFiles).toBe(1);
      expect(receivedStats!.zstdFiles).toBe(1);
      expect(receivedStats!.brotliFiles).toBe(0);
      expect(receivedStats!.gzipFiles).toBe(0);
      expect(receivedStats!.fileDetails).toHaveLength(1);
      expect(receivedStats!.fileDetails[0].algorithm).toBe('zstd');
    });

    it.skipIf(!zstdAvailable)('should respect compressionThreshold with zstd', async () => {
      // Use pseudo-random content that won't compress well
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
      let content = '';
      for (let i = 0; i < 3000; i++) {
        content += chars[(i * 7 + 13) % chars.length];
      }
      createTestFile(testDir, 'data.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0.99,
        onComplete: (stats) => { receivedStats = stats; },
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'data.js.zst'))).toBe(false);
      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.skippedFiles).toBeGreaterThan(0);
    });

    it.skipIf(!zstdAvailable)('should work with verifyIntegrity', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        verifyIntegrity: true,
        onComplete: (stats) => { receivedStats = stats; },
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'app.js.zst'))).toBe(true);
      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.compressedFiles).toBe(1);
      expect(receivedStats!.failedFiles).toBe(0);
    });

    it.skipIf(!zstdAvailable)('should not produce .br or .gz files when type is ZSTD', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'app.js.zst'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(false);
      expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(false);
    });

    it.skipIf(!zstdAvailable)('should include zstd in build report', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      const reportPath = path.join(testDir, 'report.json');

      const plugin = brotliCompress({
        type: CompressionType.ZSTD,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionReport: reportPath,
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(report.summary.compressionType).toBe('zstd');
      expect(report.summary.zstdFiles).toBe(1);
      expect(report.files[0].algorithm).toBe('zstd');
    });
  });
});
