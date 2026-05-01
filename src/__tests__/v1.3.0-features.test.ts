import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import brotliCompress, {
  CompressionType,
  CompressionStats,
  CompressionProgress,
} from '../index';

// Helper function to create temporary test directory
function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-v130-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Helper function to create test files
function createTestFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper function to clean up test directory
function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Generate highly compressible content (repeated text)
function compressibleContent(sizeMultiplier = 100): string {
  return 'console.log("Hello, World!"); '.repeat(sizeMultiplier);
}

// Generate poorly compressible content (random-ish data)
function incompressibleContent(size = 2048): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars[(i * 7 + 13) % chars.length];
  }
  return result;
}

describe('v1.3.0 Features', () => {
  let testDir: string;
  let mockConfig: any;

  beforeEach(() => {
    testDir = createTestDir();
    mockConfig = {
      build: {
        outDir: testDir
      }
    };
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Feature 1: Compression ratio threshold
  // ────────────────────────────────────────────────────────────────────────────
  describe('compressionThreshold', () => {
    it('should keep compressed files when ratio exceeds threshold', async () => {
      const content = compressibleContent(200); // highly compressible
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0.05 // require at least 5% savings
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Highly compressible content should easily pass a 5% threshold
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    });

    it('should discard compressed files when ratio is below threshold', async () => {
      // Create a very small file that won't compress well
      const content = incompressibleContent(2048);
      createTestFile(testDir, 'data.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0.99 // require 99% savings — virtually impossible
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Compressed file should be discarded since it can't achieve 99% savings
      expect(fs.existsSync(path.join(testDir, 'data.js.br'))).toBe(false);
    });

    it('should keep all files when threshold is 0 (default)', async () => {
      const content = incompressibleContent(2048);
      createTestFile(testDir, 'data.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // With threshold 0, all compressed files should be kept
      expect(fs.existsSync(path.join(testDir, 'data.js.br'))).toBe(true);
    });

    it('should apply threshold independently for brotli and gzip in BOTH mode', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0.05
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Both should pass for highly compressible content
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'app.js.gz'))).toBe(true);
    });

    it('should report skipped files in onComplete stats when threshold filters files', async () => {
      const content = incompressibleContent(2048);
      createTestFile(testDir, 'data.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        compressionThreshold: 0.99,
        onComplete: (stats) => {
          receivedStats = stats;
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.skippedFiles).toBeGreaterThan(0);
      expect(receivedStats!.compressedFiles).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Feature 2: Progress callback
  // ────────────────────────────────────────────────────────────────────────────
  describe('onProgress callback', () => {
    it('should call onProgress for each file processed', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'file1.js', content);
      createTestFile(testDir, 'file2.js', content);
      createTestFile(testDir, 'file3.js', content);

      const progressCalls: CompressionProgress[] = [];

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onProgress: (progress) => {
          progressCalls.push({ ...progress });
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(progressCalls.length).toBe(3);
    });

    it('should report correct percentage values', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'a.js', content);
      createTestFile(testDir, 'b.js', content);

      const progressCalls: CompressionProgress[] = [];

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        parallel: false, // sequential for deterministic ordering
        onProgress: (progress) => {
          progressCalls.push({ ...progress });
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(progressCalls.length).toBe(2);
      expect(progressCalls[0].percentage).toBe(50);
      expect(progressCalls[1].percentage).toBe(100);
      expect(progressCalls[0].currentIndex).toBe(0);
      expect(progressCalls[1].currentIndex).toBe(1);
      expect(progressCalls[0].totalFiles).toBe(2);
      expect(progressCalls[1].totalFiles).toBe(2);
    });

    it('should include file path in progress', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'single.js', content);

      const progressCalls: CompressionProgress[] = [];

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onProgress: (progress) => {
          progressCalls.push({ ...progress });
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(progressCalls.length).toBe(1);
      expect(progressCalls[0].currentFile).toContain('single.js');
    });

    it('should not error when onProgress is not provided', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'file.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0
        // no onProgress
      });

      (plugin.configResolved as any)(mockConfig);
      await expect((plugin.closeBundle as any)()).resolves.not.toThrow();
    });

    it('should call onProgress in parallel mode', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'p1.js', content);
      createTestFile(testDir, 'p2.js', content);

      const progressCalls: CompressionProgress[] = [];

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        parallel: true,
        maxParallel: 5,
        onProgress: (progress) => {
          progressCalls.push({ ...progress });
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(progressCalls.length).toBe(2);
      // Last call should be 100%
      expect(progressCalls[progressCalls.length - 1].percentage).toBe(100);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Feature 3: onComplete stats callback
  // ────────────────────────────────────────────────────────────────────────────
  describe('onComplete callback', () => {
    it('should call onComplete with final stats', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);
      createTestFile(testDir, 'styles.css', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        extensions: ['js', 'css'],
        verbose: false,
        minSize: 0,
        onComplete: (stats) => {
          receivedStats = stats;
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.totalFiles).toBe(2);
      expect(receivedStats!.compressedFiles).toBe(2);
      expect(receivedStats!.failedFiles).toBe(0);
      expect(receivedStats!.totalOriginalSize).toBeGreaterThan(0);
      expect(receivedStats!.totalCompressedSize).toBeGreaterThan(0);
      expect(receivedStats!.compressionRatio).toBeGreaterThan(0);
      expect(receivedStats!.timeElapsed).toBeGreaterThanOrEqual(0);
    });

    it('should include fileDetails in stats', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'bundle.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onComplete: (stats) => {
          receivedStats = stats;
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.fileDetails).toBeDefined();
      expect(receivedStats!.fileDetails.length).toBe(1);
      expect(receivedStats!.fileDetails[0].algorithm).toBe('brotli');
      expect(receivedStats!.fileDetails[0].originalSize).toBeGreaterThan(0);
      expect(receivedStats!.fileDetails[0].compressedSize).toBeGreaterThan(0);
      expect(receivedStats!.fileDetails[0].filePath).toContain('.br');
    });

    it('should include both brotli and gzip in fileDetails when type is BOTH', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onComplete: (stats) => {
          receivedStats = stats;
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.fileDetails.length).toBe(2);

      const algorithms = receivedStats!.fileDetails.map(d => d.algorithm);
      expect(algorithms).toContain('brotli');
      expect(algorithms).toContain('gzip');
    });

    it('should not error when onComplete is not provided', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'file.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0
        // no onComplete
      });

      (plugin.configResolved as any)(mockConfig);
      await expect((plugin.closeBundle as any)()).resolves.not.toThrow();
    });

    it('should report correct brotliFiles and gzipFiles counts', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'a.js', content);
      createTestFile(testDir, 'b.js', content);

      let receivedStats: CompressionStats | null = null;

      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        onComplete: (stats) => {
          receivedStats = stats;
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(receivedStats).not.toBeNull();
      expect(receivedStats!.brotliFiles).toBe(2);
      expect(receivedStats!.gzipFiles).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Feature 4: Size budget warnings
  // ────────────────────────────────────────────────────────────────────────────
  describe('budget', () => {
    it('should not warn when compressed output is within budget', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        budget: {
          maxTotalSize: 10 * 1024 * 1024, // 10MB — plenty of room
          maxFileSize: 10 * 1024 * 1024,
          action: 'warn'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const budgetWarns = warnSpy.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('Budget exceeded')
      );
      expect(budgetWarns.length).toBe(0);

      warnSpy.mockRestore();
    });

    it('should warn when total compressed size exceeds maxTotalSize', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        budget: {
          maxTotalSize: 1, // 1 byte — will definitely be exceeded
          action: 'warn'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const budgetWarns = warnSpy.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('Budget exceeded')
      );
      expect(budgetWarns.length).toBe(1);

      warnSpy.mockRestore();
    });

    it('should warn when any single file exceeds maxFileSize', async () => {
      const content = compressibleContent(200);
      createTestFile(testDir, 'big.js', content);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        budget: {
          maxFileSize: 1, // 1 byte
          action: 'warn'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const budgetWarns = warnSpy.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('Budget exceeded')
      );
      expect(budgetWarns.length).toBe(1);

      warnSpy.mockRestore();
    });

    it('should throw when action is error and budget is exceeded', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        continueOnError: false,
        budget: {
          maxTotalSize: 1,
          action: 'error'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await expect((plugin.closeBundle as any)()).rejects.toThrow('Budget exceeded');
    });

    it('should default action to warn when not specified', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        budget: {
          maxTotalSize: 1
          // no action specified — should default to 'warn'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await expect((plugin.closeBundle as any)()).resolves.not.toThrow();

      const budgetWarns = warnSpy.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('Budget exceeded')
      );
      expect(budgetWarns.length).toBe(1);

      warnSpy.mockRestore();
    });

    it('should check both maxTotalSize and maxFileSize together', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'a.js', content);
      createTestFile(testDir, 'b.js', content);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0,
        budget: {
          maxTotalSize: 1,
          maxFileSize: 1,
          action: 'warn'
        }
      });

      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const budgetWarns = warnSpy.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('Budget exceeded')
      );
      // Should have one warning message containing all violations
      expect(budgetWarns.length).toBe(1);
      // The message should mention both total size and per-file violations
      expect(budgetWarns[0][0]).toContain('Total compressed size');
      expect(budgetWarns[0][0]).toContain('per-file budget');

      warnSpy.mockRestore();
    });

    it('should not interfere when budget is not configured', async () => {
      const content = compressibleContent(100);
      createTestFile(testDir, 'app.js', content);

      const plugin = brotliCompress({
        extensions: ['js'],
        verbose: false,
        minSize: 0
        // no budget
      });

      (plugin.configResolved as any)(mockConfig);
      await expect((plugin.closeBundle as any)()).resolves.not.toThrow();
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Plugin creation with new options
  // ────────────────────────────────────────────────────────────────────────────
  describe('Plugin creation with v1.3.0 options', () => {
    it('should create plugin with all new options combined', () => {
      const plugin = brotliCompress({
        compressionThreshold: 0.1,
        onProgress: () => {},
        onComplete: () => {},
        budget: {
          maxTotalSize: 500_000,
          maxFileSize: 200_000,
          action: 'warn'
        },
        verbose: false
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });

    it('should be backward compatible with v1.2.0 options', () => {
      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        extensions: ['js', 'css'],
        quality: 9,
        gzipLevel: 6,
        minSize: 1024,
        maxSize: 10 * 1024 * 1024,
        excludePatterns: ['**/vendor/**'],
        parallel: true,
        maxParallel: 10,
        skipExisting: true,
        continueOnError: true,
        retryAttempts: 2,
        verbose: false
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });
  });
});
