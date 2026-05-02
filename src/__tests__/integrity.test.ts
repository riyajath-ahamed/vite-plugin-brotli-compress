import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import brotliCompress, { CompressionType, CompressionStats } from '../index';

function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-integrity-${Date.now()}`);
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

describe('Streaming Hash Verification', () => {
  let testDir: string;
  let mockConfig: any;

  beforeEach(() => {
    testDir = createTestDir();
    mockConfig = { build: { outDir: testDir } };
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should compress and verify files when verifyIntegrity is true', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
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

  it('should work with gzip and verifyIntegrity', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.GZIP,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      verifyIntegrity: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.failedFiles).toBe(0);
  });

  it('should verify both brotli and gzip when type is BOTH', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      type: CompressionType.BOTH,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      verifyIntegrity: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(2);
    expect(receivedStats!.failedFiles).toBe(0);
  });

  it('should not verify when verifyIntegrity is false (default)', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(1);
    expect(receivedStats!.failedFiles).toBe(0);
  });

  it('should verify multiple files successfully', async () => {
    const content = compressibleContent(100);
    createTestFile(testDir, 'a.js', content);
    createTestFile(testDir, 'b.js', content);
    createTestFile(testDir, 'c.css', content);

    let receivedStats: CompressionStats | null = null;

    const plugin = brotliCompress({
      extensions: ['js', 'css'],
      verbose: false,
      minSize: 0,
      verifyIntegrity: true,
      onComplete: (stats) => { receivedStats = stats; },
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(receivedStats).not.toBeNull();
    expect(receivedStats!.compressedFiles).toBe(3);
    expect(receivedStats!.failedFiles).toBe(0);
  });
});
