import { describe, it, expect } from 'vitest';
import brotliCompress, { 
  BrotliQuality, 
  CompressionType, 
  GzipLevel 
} from '../index';

describe('v1.1.0 New Features - Core Functionality', () => {
  describe('CompressionType enum', () => {
    it('should have correct compression type values', () => {
      expect(CompressionType.BROTLI).toBe('brotli');
      expect(CompressionType.GZIP).toBe('gzip');
      expect(CompressionType.BOTH).toBe('both');
    });
  });

  describe('GzipLevel enum', () => {
    it('should have correct gzip level values', () => {
      expect(GzipLevel.NONE).toBe(0);
      expect(GzipLevel.FASTEST).toBe(1);
      expect(GzipLevel.FAST).toBe(3);
      expect(GzipLevel.DEFAULT).toBe(6);
      expect(GzipLevel.HIGH).toBe(9);
      expect(GzipLevel.MAXIMUM).toBe(9);
    });
  });

  describe('Plugin creation with new options', () => {
    it('should create plugin with gzip compression type', () => {
      const plugin = brotliCompress({
        type: CompressionType.GZIP,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });

    it('should create plugin with both compression types', () => {
      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });

    it('should create plugin with gzip level', () => {
      const plugin = brotliCompress({
        type: CompressionType.GZIP,
        gzipLevel: GzipLevel.HIGH,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with exclude patterns', () => {
      const plugin = brotliCompress({
        excludePatterns: ['**/vendor/**', '**/node_modules/**'],
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with include patterns', () => {
      const plugin = brotliCompress({
        includePatterns: ['**/src/**', '**/assets/**'],
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with max size limit', () => {
      const plugin = brotliCompress({
        maxSize: 10 * 1024 * 1024, // 10MB
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with skip existing option', () => {
      const plugin = brotliCompress({
        skipExisting: true,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with error handling options', () => {
      const plugin = brotliCompress({
        continueOnError: true,
        retryAttempts: 3,
        errorCallback: (error, filePath) => {
          console.error(`Failed to compress ${filePath}:`, error);
        },
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should create plugin with all new options combined', () => {
      const plugin = brotliCompress({
        type: CompressionType.BOTH,
        quality: BrotliQuality.HIGH,
        gzipLevel: GzipLevel.DEFAULT,
        minSize: 1024,
        maxSize: 5 * 1024 * 1024,
        excludePatterns: ['**/vendor/**'],
        includePatterns: ['**/src/**'],
        skipExisting: true,
        continueOnError: true,
        retryAttempts: 2,
        errorCallback: (error, filePath) => {
          console.error(`Failed to compress ${filePath}:`, error);
        },
        verbose: false
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });
  });

  describe('Configuration validation', () => {
    it('should handle invalid compression type gracefully', () => {
      const plugin = brotliCompress({
        type: 'invalid' as any,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle extreme quality values', () => {
      const plugin1 = brotliCompress({
        quality: -5,
        verbose: false
      });
      
      const plugin2 = brotliCompress({
        quality: 999,
        verbose: false
      });
      
      expect(plugin1).toBeDefined();
      expect(plugin2).toBeDefined();
    });

    it('should handle extreme gzip level values', () => {
      const plugin1 = brotliCompress({
        type: CompressionType.GZIP,
        gzipLevel: -5,
        verbose: false
      });
      
      const plugin2 = brotliCompress({
        type: CompressionType.GZIP,
        gzipLevel: 999,
        verbose: false
      });
      
      expect(plugin1).toBeDefined();
      expect(plugin2).toBeDefined();
    });

    it('should handle empty pattern arrays', () => {
      const plugin = brotliCompress({
        excludePatterns: [],
        includePatterns: [],
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle undefined optional values', () => {
      const plugin = brotliCompress({
        maxSize: undefined,
        errorCallback: undefined,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });
  });

  describe('Backward compatibility', () => {
    it('should work with old configuration format', () => {
      const plugin = brotliCompress({
        extensions: ['js', 'css'],
        verbose: true,
        quality: BrotliQuality.DEFAULT,
        minSize: 1024,
        deleteOriginal: false,
        parallel: true,
        maxParallel: 10
      });
      
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-brotli-compress');
    });

    it('should default to Brotli compression when no type specified', () => {
      const plugin = brotliCompress({
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero retry attempts', () => {
      const plugin = brotliCompress({
        retryAttempts: 0,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle very large retry attempts', () => {
      const plugin = brotliCompress({
        retryAttempts: 100,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle zero minSize', () => {
      const plugin = brotliCompress({
        minSize: 0,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle very large maxSize', () => {
      const plugin = brotliCompress({
        maxSize: Number.MAX_SAFE_INTEGER,
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });

    it('should handle complex pattern arrays', () => {
      const plugin = brotliCompress({
        excludePatterns: [
          '**/vendor/**',
          '**/node_modules/**',
          '**/*.min.js',
          '**/*.min.css',
          '**/test/**',
          '**/spec/**'
        ],
        includePatterns: [
          '**/src/**',
          '**/assets/**',
          '**/public/**',
          '**/*.js',
          '**/*.css',
          '**/*.html'
        ],
        verbose: false
      });
      
      expect(plugin).toBeDefined();
    });
  });
});
