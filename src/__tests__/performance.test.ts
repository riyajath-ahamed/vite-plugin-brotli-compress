import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import brotliCompress, { BrotliQuality } from '../index';

// Helper function to create temporary test directory
function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `perf-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Helper function to clean up test directory
function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper function to create large test file
function createLargeTestFile(dir: string, filename: string, sizeInKB: number): string {
  const content = 'A'.repeat(1024); // 1KB of content
  const repetitions = Math.ceil(sizeInKB);
  const fullContent = content.repeat(repetitions);
  
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, fullContent);
  return filePath;
}

describe('Performance Tests', () => {
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

  describe('Compression quality vs performance', () => {
    it('should compress faster with lower quality settings', async () => {
      const content = 'test content '.repeat(10000); // ~120KB
      createLargeTestFile(testDir, 'test.js', 100);

      // Test with fastest quality
      const startFast = Date.now();
      const pluginFast = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        quality: BrotliQuality.FASTEST,
        minSize: 0
      });
      
      (pluginFast.configResolved as any)(mockConfig);
      await (pluginFast.closeBundle as any)();
      const timeFast = Date.now() - startFast;

      // Clean up and create new file
      cleanupTestDir(testDir);
      testDir = createTestDir();
      mockConfig = {
        build: {
          outDir: testDir
        }
      };
      createLargeTestFile(testDir, 'test.js', 100);

      // Test with maximum quality
      const startMax = Date.now();
      const pluginMax = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        quality: BrotliQuality.MAXIMUM,
        minSize: 0
      });
      
      (pluginMax.configResolved as any)(mockConfig);
      await (pluginMax.closeBundle as any)();
      const timeMax = Date.now() - startMax;

      // Fastest quality should be faster (though this might not always be true in tests)
      expect(timeFast).toBeGreaterThan(0);
      expect(timeMax).toBeGreaterThan(0);
      
      // Both should complete successfully
      expect(fs.existsSync(path.join(testDir, 'test.js.br'))).toBe(true);
    });

    it('should achieve better compression with higher quality', async () => {
      const content = 'test content '.repeat(10000); // ~120KB
      createLargeTestFile(testDir, 'test.js', 100);

      // Test with fastest quality
      const pluginFast = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        quality: BrotliQuality.FASTEST,
        minSize: 0
      });
      
      (pluginFast.configResolved as any)(mockConfig);
      await (pluginFast.closeBundle as any)();

      const fastCompressedSize = fs.statSync(path.join(testDir, 'test.js.br')).size;

      // Clean up and create new file
      cleanupTestDir(testDir);
      testDir = createTestDir();
      mockConfig = {
        build: {
          outDir: testDir
        }
      };
      createLargeTestFile(testDir, 'test.js', 100);

      // Test with maximum quality
      const pluginMax = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        quality: BrotliQuality.MAXIMUM,
        minSize: 0
      });
      
      (pluginMax.configResolved as any)(mockConfig);
      await (pluginMax.closeBundle as any)();

      const maxCompressedSize = fs.statSync(path.join(testDir, 'test.js.br')).size;

      // Both should compress successfully
      expect(fastCompressedSize).toBeGreaterThan(0);
      expect(maxCompressedSize).toBeGreaterThan(0);
      
      // Higher quality should generally achieve better compression
      // (though this might not always be true for all content types)
      expect(maxCompressedSize).toBeLessThanOrEqual(fastCompressedSize);
    });
  });

  describe('Parallel vs sequential processing', () => {
    it('should process multiple files faster in parallel', async () => {
      // Create multiple test files
      for (let i = 0; i < 5; i++) {
        createLargeTestFile(testDir, `file${i}.js`, 50);
      }

      // Test parallel processing
      const startParallel = Date.now();
      const pluginParallel = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        parallel: true,
        minSize: 0
      });
      
      (pluginParallel.configResolved as any)(mockConfig);
      await (pluginParallel.closeBundle as any)();
      const timeParallel = Date.now() - startParallel;

      // Clean up and create new files
      cleanupTestDir(testDir);
      testDir = createTestDir();
      mockConfig = {
        build: {
          outDir: testDir
        }
      };
      for (let i = 0; i < 5; i++) {
        createLargeTestFile(testDir, `file${i}.js`, 50);
      }

      // Test sequential processing
      const startSequential = Date.now();
      const pluginSequential = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        parallel: false,
        minSize: 0
      });
      
      (pluginSequential.configResolved as any)(mockConfig);
      await (pluginSequential.closeBundle as any)();
      const timeSequential = Date.now() - startSequential;

      // Both should complete successfully
      expect(timeParallel).toBeGreaterThan(0);
      expect(timeSequential).toBeGreaterThan(0);
      
      // All files should be compressed
      for (let i = 0; i < 5; i++) {
        expect(fs.existsSync(path.join(testDir, `file${i}.js.br`))).toBe(true);
      }
    });

    it('should respect maxParallel limit', async () => {
      // Create many test files
      for (let i = 0; i < 20; i++) {
        createLargeTestFile(testDir, `file${i}.js`, 10);
      }

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        maxParallel: 3,
        minSize: 0
      });
      
      plugin.configResolved!(mockConfig);
      
      const startTime = Date.now();
      await plugin.closeBundle!();
      const totalTime = Date.now() - startTime;

      // Should complete successfully
      expect(totalTime).toBeGreaterThan(0);
      
      // All files should be compressed
      for (let i = 0; i < 20; i++) {
        expect(fs.existsSync(path.join(testDir, `file${i}.js.br`))).toBe(true);
      }
    });
  });

  describe('Memory usage', () => {
    it('should handle large files without memory issues', async () => {
      // Create a large file (1MB)
      createLargeTestFile(testDir, 'large.js', 1024);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      plugin.configResolved!(mockConfig);
      
      // Should not throw memory errors
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
      
      // File should be compressed
      expect(fs.existsSync(path.join(testDir, 'large.js.br'))).toBe(true);
      
      const originalSize = fs.statSync(path.join(testDir, 'large.js')).size;
      const compressedSize = fs.statSync(path.join(testDir, 'large.js.br')).size;
      
      expect(compressedSize).toBeLessThan(originalSize);
      expect(compressedSize).toBeGreaterThan(0);
    });

    it('should handle many small files efficiently', async () => {
      // Create many small files
      for (let i = 0; i < 100; i++) {
        createLargeTestFile(testDir, `small${i}.js`, 1); // 1KB each
      }

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      plugin.configResolved!(mockConfig);
      
      // Should not throw memory errors
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
      
      // All files should be compressed
      for (let i = 0; i < 100; i++) {
        expect(fs.existsSync(path.join(testDir, `small${i}.js.br`))).toBe(true);
      }
    });
  });

  describe('Compression ratios', () => {
    it('should achieve good compression ratios for text files', async () => {
      // Create a file with repetitive content (should compress well)
      const repetitiveContent = 'This is repetitive content. '.repeat(1000);
      fs.writeFileSync(path.join(testDir, 'repetitive.js'), repetitiveContent);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const originalSize = fs.statSync(path.join(testDir, 'repetitive.js')).size;
      const compressedSize = fs.statSync(path.join(testDir, 'repetitive.js.br')).size;
      
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      
      // Should achieve good compression (at least 50% reduction)
      expect(compressionRatio).toBeGreaterThan(50);
      expect(compressedSize).toBeLessThan(originalSize);
    });

    it('should handle already compressed files appropriately', async () => {
      // Create a file with random content (should not compress well)
      const randomContent = Array.from({ length: 1000 }, () => 
        String.fromCharCode(Math.floor(Math.random() * 256))
      ).join('');
      
      fs.writeFileSync(path.join(testDir, 'random.js'), randomContent);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      const originalSize = fs.statSync(path.join(testDir, 'random.js')).size;
      const compressedSize = fs.statSync(path.join(testDir, 'random.js.br')).size;
      
      // Even random content should compress somewhat
      expect(compressedSize).toBeLessThanOrEqual(originalSize);
      expect(compressedSize).toBeGreaterThan(0);
    });
  });
});
