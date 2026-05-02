import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import brotliCompress, { CompressionType } from '../index';

function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-report-${Date.now()}`);
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

describe('Build Report Output', () => {
  let testDir: string;
  let mockConfig: any;

  beforeEach(() => {
    testDir = createTestDir();
    mockConfig = { build: { outDir: testDir } };
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should write a JSON report to the specified path', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    const reportPath = path.join(testDir, 'compression-stats.json');

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      compressionReport: reportPath,
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(reportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    expect(report.version).toBe('1.0');
    expect(report.timestamp).toBeDefined();
    expect(report.summary.totalFiles).toBe(1);
    expect(report.summary.compressedFiles).toBe(1);
    expect(report.summary.totalOriginalSize).toBeGreaterThan(0);
    expect(report.summary.totalCompressedSize).toBeGreaterThan(0);
    expect(report.summary.compressionRatio).toBeGreaterThan(0);
    expect(report.summary.timeElapsed).toBeGreaterThanOrEqual(0);
    expect(report.files).toHaveLength(1);
    expect(report.files[0].algorithm).toBe('brotli');
    expect(report.files[0].savings).toMatch(/%$/);
  });

  it('should include both algorithms in report when type is BOTH', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    const reportPath = path.join(testDir, 'report.json');

    const plugin = brotliCompress({
      type: CompressionType.BOTH,
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      compressionReport: reportPath,
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    expect(report.summary.compressionType).toBe('both');
    expect(report.summary.brotliFiles).toBe(1);
    expect(report.summary.gzipFiles).toBe(1);
    expect(report.files).toHaveLength(2);

    const algorithms = report.files.map((f: any) => f.algorithm);
    expect(algorithms).toContain('brotli');
    expect(algorithms).toContain('gzip');
  });

  it('should create parent directories for report path', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    const reportPath = path.join(testDir, 'nested', 'dir', 'report.json');

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
      compressionReport: reportPath,
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(reportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(report.summary.compressedFiles).toBe(1);
  });

  it('should not write report when option is not set', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'app.js', content);

    const reportPath = path.join(testDir, 'report.json');

    const plugin = brotliCompress({
      extensions: ['js'],
      verbose: false,
      minSize: 0,
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    expect(fs.existsSync(reportPath)).toBe(false);
  });

  it('should include per-file details with correct savings percentages', async () => {
    const content = compressibleContent(200);
    createTestFile(testDir, 'a.js', content);
    createTestFile(testDir, 'b.css', content);

    const reportPath = path.join(testDir, 'report.json');

    const plugin = brotliCompress({
      extensions: ['js', 'css'],
      verbose: false,
      minSize: 0,
      compressionReport: reportPath,
    });

    (plugin.configResolved as any)(mockConfig);
    await (plugin.closeBundle as any)();

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    expect(report.files).toHaveLength(2);
    for (const file of report.files) {
      expect(file.filePath).toBeDefined();
      expect(file.originalSize).toBeGreaterThan(0);
      expect(file.compressedSize).toBeGreaterThan(0);
      expect(file.compressedSize).toBeLessThan(file.originalSize);
      expect(parseFloat(file.savings)).toBeGreaterThan(0);
    }
  });
});
