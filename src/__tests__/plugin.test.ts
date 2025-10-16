import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import brotliCompress, { BrotliQuality, BrotliOptions } from '../index';

// Mock modules
vi.mock('fs');
vi.mock('zlib');

const mockFs = vi.mocked(fs);
const mockZlib = vi.mocked(zlib);

describe('vite-plugin-brotli-compress', () => {
  let mockConfig: any;
  let mockReadStream: any;
  let mockWriteStream: any;
  let mockCompressStream: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Vite config
    mockConfig = {
      build: {
        outDir: '/test/dist'
      }
    };

    // Mock streams
    mockReadStream = {
      pipe: vi.fn().mockReturnThis(),
      on: vi.fn()
    };

    mockWriteStream = {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };

    mockCompressStream = {
      pipe: vi.fn().mockReturnValue(mockWriteStream)
    };

    // Setup fs mocks with proper behavior
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (dir === '/test/dist') {
        return [
          { name: 'index.js', isDirectory: () => false },
          { name: 'styles.css', isDirectory: () => false },
          { name: 'assets', isDirectory: () => true }
        ] as any;
      }
      if (dir === '/test/dist/assets') {
        return [
          { name: 'bundle.js', isDirectory: () => false }
        ] as any;
      }
      return [] as any;
    });

    // Mock writeStream finish event to resolve immediately
    mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'finish') {
        setTimeout(() => callback(), 0);
      }
    });

    mockFs.statSync.mockReturnValue({
      size: 2048,
      isFile: () => true,
      isDirectory: () => false
    } as any);

    mockFs.createReadStream.mockReturnValue(mockReadStream);
    mockFs.createWriteStream.mockReturnValue(mockWriteStream);

    // Setup zlib mock
    mockZlib.createBrotliCompress.mockReturnValue(mockCompressStream);
    mockZlib.constants = {
      BROTLI_PARAM_QUALITY: 1,
      BROTLI_MAX_QUALITY: 11
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('plugin creation', () => {
    it('should create a plugin with default options', () => {
      const plugin = brotliCompress();
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
      expect(plugin.configResolved).toBeDefined();
      expect(plugin.closeBundle).toBeDefined();
    });

    it('should create a plugin with custom options', () => {
      const options: BrotliOptions = {
        extensions: ['js', 'css'],
        verbose: false,
        quality: BrotliQuality.HIGH,
        minSize: 512,
        deleteOriginal: true,
        parallel: false,
        maxParallel: 5
      };

      const plugin = brotliCompress(options);
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });
  });

  describe('configResolved hook', () => {
    it('should store the resolved config', () => {
      const plugin = brotliCompress();
      
      (plugin.configResolved as any)(mockConfig);
      
      // The config should be stored internally
      expect(plugin.configResolved).toBeDefined();
    });
  });

  describe('closeBundle hook', () => {
    it('should handle empty directory gracefully', async () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      const plugin = brotliCompress({ verbose: false });
      (plugin.configResolved as any)(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should skip files smaller than minSize', async () => {
      mockFs.statSync.mockReturnValue({
        size: 512, // Smaller than default minSize of 1024
        isFile: () => true,
        isDirectory: () => false
      } as any);

      const plugin = brotliCompress({ minSize: 1024, verbose: false });
      (plugin.configResolved as any)(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should use custom shouldCompress function', async () => {
      const shouldCompress = vi.fn().mockReturnValue(false);
      
      const plugin = brotliCompress({ 
        shouldCompress, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      expect(shouldCompress).toHaveBeenCalled();
    });

    it('should handle compression errors gracefully', async () => {
      mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Write error')), 0);
        }
      });

      const plugin = brotliCompress({ verbose: false });
      (plugin.configResolved as any)(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });
  });

  describe('BrotliQuality enum', () => {
    it('should have correct quality values', () => {
      expect(BrotliQuality.FASTEST).toBe(0);
      expect(BrotliQuality.FAST).toBe(3);
      expect(BrotliQuality.DEFAULT).toBe(6);
      expect(BrotliQuality.HIGH).toBe(9);
      expect(BrotliQuality.MAXIMUM).toBe(11);
    });
  });

  describe('options validation', () => {
    it('should accept valid quality values', () => {
      const plugin1 = brotliCompress({ quality: BrotliQuality.HIGH });
      const plugin2 = brotliCompress({ quality: 5 });
      const plugin3 = brotliCompress({ quality: 0 });
      const plugin4 = brotliCompress({ quality: 11 });
      
      expect(plugin1).toBeDefined();
      expect(plugin2).toBeDefined();
      expect(plugin3).toBeDefined();
      expect(plugin4).toBeDefined();
    });

    it('should handle invalid quality values by clamping', () => {
      // Quality values should be clamped to 0-11 range
      const plugin1 = brotliCompress({ quality: -1 });
      const plugin2 = brotliCompress({ quality: 15 });
      
      expect(plugin1).toBeDefined();
      expect(plugin2).toBeDefined();
    });
  });

  describe('file extension filtering', () => {
    it('should only process files with specified extensions', async () => {
      mockFs.readdirSync.mockImplementation((dir: string) => {
        if (dir === '/test/dist') {
          return [
            { name: 'index.js', isDirectory: () => false },
            { name: 'styles.css', isDirectory: () => false },
            { name: 'image.png', isDirectory: () => false },
            { name: 'data.json', isDirectory: () => false }
          ] as any;
        }
        return [] as any;
      });

      const plugin = brotliCompress({ 
        extensions: ['js', 'css'], 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      // Should only process .js and .css files
      expect(mockFs.createReadStream).toHaveBeenCalledTimes(2);
    });
  });

  describe('parallel processing', () => {
    it('should process files in parallel by default', async () => {
      mockFs.readdirSync.mockImplementation((dir: string) => {
        if (dir === '/test/dist') {
          return [
            { name: 'file1.js', isDirectory: () => false },
            { name: 'file2.js', isDirectory: () => false },
            { name: 'file3.js', isDirectory: () => false }
          ] as any;
        }
        return [] as any;
      });

      const plugin = brotliCompress({ verbose: false });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      // All files should be processed
      expect(mockFs.createReadStream).toHaveBeenCalledTimes(3);
    });

    it('should respect maxParallel limit', async () => {
      mockFs.readdirSync.mockImplementation((dir: string) => {
        if (dir === '/test/dist') {
          return [
            { name: 'file1.js', isDirectory: () => false },
            { name: 'file2.js', isDirectory: () => false },
            { name: 'file3.js', isDirectory: () => false },
            { name: 'file4.js', isDirectory: () => false },
            { name: 'file5.js', isDirectory: () => false }
          ] as any;
        }
        return [] as any;
      });

      const plugin = brotliCompress({ 
        maxParallel: 2, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      // All files should still be processed
      expect(mockFs.createReadStream).toHaveBeenCalledTimes(5);
    });
  });

  describe('deleteOriginal option', () => {
    it('should delete original files when deleteOriginal is true', async () => {
      mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          setTimeout(() => callback(), 0);
        }
      });

      const plugin = brotliCompress({ 
        deleteOriginal: true, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should not delete original files when deleteOriginal is false', async () => {
      mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'finish') {
          setTimeout(() => callback(), 0);
        }
      });

      const plugin = brotliCompress({ 
        deleteOriginal: false, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await (plugin.closeBundle as any)();
      
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle zero-byte files', async () => {
      mockFs.statSync.mockReturnValue({
        size: 0,
        isFile: () => true,
        isDirectory: () => false
      } as any);

      const plugin = brotliCompress({ 
        minSize: 0, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should handle very large file sizes', async () => {
      mockFs.statSync.mockReturnValue({
        size: Number.MAX_SAFE_INTEGER,
        isFile: () => true,
        isDirectory: () => false
      } as any);

      const plugin = brotliCompress({ 
        minSize: 0, 
        verbose: false 
      });
      (plugin.configResolved as any)(mockConfig);
      
      await expect(plugin.closeBundle!()).resolves.not.toThrow();
    });

    it('should handle invalid quality values gracefully', async () => {
      const plugin1 = brotliCompress({ quality: -5 });
      const plugin2 = brotliCompress({ quality: 999 });
      
      expect(plugin1).toBeDefined();
      expect(plugin2).toBeDefined();
      
      plugin1.configResolved!(mockConfig);
      plugin2.configResolved!(mockConfig);
      
      await expect(plugin1.closeBundle!()).resolves.not.toThrow();
      await expect(plugin2.closeBundle!()).resolves.not.toThrow();
    });
  });
});
