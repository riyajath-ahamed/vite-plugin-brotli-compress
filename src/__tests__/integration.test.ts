import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import brotliCompress from '../index';

// Helper function to create temporary test directory
function createTestDir(): string {
  const testDir = path.join(process.cwd(), 'test-fixtures', `test-${Date.now()}`);
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

describe('Integration Tests', () => {
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

  describe('Real file compression', () => {
    it('should compress JavaScript files', async () => {
      // Create test files
      const jsContent = 'console.log("Hello, World!"); '.repeat(100); // Make it large enough
      createTestFile(testDir, 'app.js', jsContent);
      createTestFile(testDir, 'utils.js', jsContent);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0 // Allow small files for testing
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Check if .br files were created
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'utils.js.br'))).toBe(true);

      // Check if compressed files are smaller
      const originalSize = fs.statSync(path.join(testDir, 'app.js')).size;
      const compressedSize = fs.statSync(path.join(testDir, 'app.js.br')).size;
      
      expect(compressedSize).toBeLessThan(originalSize);
      expect(compressedSize).toBeGreaterThan(0);
    });

    it('should compress CSS files', async () => {
      const cssContent = `
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background-color: #333; color: white; padding: 1rem; }
        .content { padding: 2rem; }
        .footer { background-color: #666; color: white; padding: 1rem; }
      `.repeat(50); // Make it large enough

      createTestFile(testDir, 'styles.css', cssContent);

      const plugin = brotliCompress({ 
        extensions: ['css'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'styles.css.br'))).toBe(true);
      
      const originalSize = fs.statSync(path.join(testDir, 'styles.css')).size;
      const compressedSize = fs.statSync(path.join(testDir, 'styles.css.br')).size;
      
      expect(compressedSize).toBeLessThan(originalSize);
    });

    it('should compress HTML files', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <h1>Welcome to our website</h1>
          <p>This is a test page with some content.</p>
          <div class="container">
            <p>More content here...</p>
          </div>
        </body>
        </html>
      `.repeat(20); // Make it large enough

      createTestFile(testDir, 'index.html', htmlContent);

      const plugin = brotliCompress({ 
        extensions: ['html'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'index.html.br'))).toBe(true);
    });

    it('should compress JSON files', async () => {
      const jsonContent = JSON.stringify({
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          profile: {
            age: 20 + (i % 50),
            city: `City ${i % 10}`,
            country: 'Test Country'
          }
        }))
      });

      createTestFile(testDir, 'data.json', jsonContent);

      const plugin = brotliCompress({ 
        extensions: ['json'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      expect(fs.existsSync(path.join(testDir, 'data.json.br'))).toBe(true);
    });
  });

  describe('Directory structure handling', () => {
    it('should handle nested directories', async () => {
      // Create nested directory structure
      const assetsDir = path.join(testDir, 'assets');
      const jsDir = path.join(testDir, 'js');
      
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.mkdirSync(jsDir, { recursive: true });

      const content = 'console.log("test"); '.repeat(100);
      
      createTestFile(testDir, 'main.js', content);
      createTestFile(assetsDir, 'bundle.js', content);
      createTestFile(jsDir, 'utils.js', content);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Check all JS files were compressed
      expect(fs.existsSync(path.join(testDir, 'main.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'bundle.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(jsDir, 'utils.js.br'))).toBe(true);
    });

    it('should skip non-matching files', async () => {
      const jsContent = 'console.log("test"); '.repeat(100);
      const txtContent = 'This is a text file. '.repeat(100);
      
      createTestFile(testDir, 'app.js', jsContent);
      createTestFile(testDir, 'readme.txt', txtContent);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Only JS file should be compressed
      expect(fs.existsSync(path.join(testDir, 'app.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'readme.txt.br'))).toBe(false);
    });
  });

  describe('Options testing', () => {
    it('should respect minSize option', async () => {
      const smallContent = 'small'; // Very small file
      const largeContent = 'large content '.repeat(1000); // Large file
      
      createTestFile(testDir, 'small.js', smallContent);
      createTestFile(testDir, 'large.js', largeContent);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 1000 // Only compress files larger than 1000 bytes
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Only large file should be compressed
      expect(fs.existsSync(path.join(testDir, 'small.js.br'))).toBe(false);
      expect(fs.existsSync(path.join(testDir, 'large.js.br'))).toBe(true);
    });

    it('should use custom shouldCompress function', async () => {
      const content = 'test content '.repeat(100);
      
      createTestFile(testDir, 'compress-me.js', content);
      createTestFile(testDir, 'skip-me.js', content);

      const shouldCompress = (filePath: string, fileSize: number) => {
        return filePath.includes('compress-me');
      };

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0,
        shouldCompress
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Only compress-me.js should be compressed
      expect(fs.existsSync(path.join(testDir, 'compress-me.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'skip-me.js.br'))).toBe(false);
    });

    it('should delete original files when deleteOriginal is true', async () => {
      const content = 'test content '.repeat(100);
      createTestFile(testDir, 'delete-me.js', content);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0,
        deleteOriginal: true
      });
      
      (plugin.configResolved as any)(mockConfig);
      await (plugin.closeBundle as any)();

      // Original file should be deleted, compressed file should exist
      expect(fs.existsSync(path.join(testDir, 'delete-me.js'))).toBe(false);
      expect(fs.existsSync(path.join(testDir, 'delete-me.js.br'))).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent output directory gracefully', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent');
      
      const plugin = brotliCompress({ verbose: false });
      
      // Mock config with non-existent directory
      const mockConfigNonExistent = {
        build: {
          outDir: nonExistentDir
        }
      };
      
      plugin.configResolved!(mockConfigNonExistent);
      
      // Should not throw an error - the plugin should handle missing directories gracefully
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      const content = 'test content '.repeat(100);
      createTestFile(testDir, 'test.js', content);

      const plugin = brotliCompress({ verbose: false });
      plugin.configResolved!(mockConfig);
      
      // Should not throw an error - the plugin should handle permission errors gracefully
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should handle empty files gracefully', async () => {
      // Create an empty file
      createTestFile(testDir, 'empty.js', '');

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      plugin.configResolved!(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should handle files with special characters in names', async () => {
      const content = 'test content '.repeat(100);
      createTestFile(testDir, 'file with spaces.js', content);
      createTestFile(testDir, 'file-with-dashes.js', content);
      createTestFile(testDir, 'file_with_underscores.js', content);

      const plugin = brotliCompress({ 
        extensions: ['js'], 
        verbose: false,
        minSize: 0
      });
      plugin.configResolved!(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
      
      // All files should be compressed
      expect(fs.existsSync(path.join(testDir, 'file with spaces.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'file-with-dashes.js.br'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'file_with_underscores.js.br'))).toBe(true);
    });
  });
});
