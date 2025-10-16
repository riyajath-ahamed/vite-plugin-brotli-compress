import type { Plugin, ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

/**
 * Compression quality levels for Brotli compression.
 */
export enum BrotliQuality {
  /** Fastest compression, lowest quality */
  FASTEST = 0,
  /** Fast compression */
  FAST = 3,
  /** Default compression */
  DEFAULT = 6,
  /** High quality compression */
  HIGH = 9,
  /** Maximum quality compression */
  MAXIMUM = 11
}

/**
 * Interface for plugin options.
 */
export interface BrotliOptions {
  /**
   * File extensions to compress.
   * @default ['js', 'html', 'css', 'json', 'ico', 'svg', 'wasm']
   */
  extensions?: string[];
  /**
   * Whether to log compression results to the console.
   * @default true
   */
  verbose?: boolean;
  /**
   * Compression quality level (0-11).
   * @default BrotliQuality.DEFAULT (6)
   */
  quality?: BrotliQuality | number;
  /**
   * Minimum file size in bytes to compress (files smaller than this will be skipped).
   * @default 1024 (1KB)
   */
  minSize?: number;
  /**
   * Whether to delete original files after compression.
   * @default false
   */
  deleteOriginal?: boolean;
  /**
   * Custom function to determine if a file should be compressed.
   * @param filePath - The file path
   * @param fileSize - The file size in bytes
   * @returns true if the file should be compressed
   */
  shouldCompress?: (filePath: string, fileSize: number) => boolean;
  /**
   * Whether to compress files in parallel.
   * @default true
   */
  parallel?: boolean;
  /**
   * Maximum number of parallel compression operations.
   * @default 10
   */
  maxParallel?: number;
}

/**
 * Compression statistics for reporting.
 */
export interface CompressionStats {
  totalFiles: number;
  compressedFiles: number;
  skippedFiles: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  timeElapsed: number;
}

/**
 * The main plugin function.
 */
export default function brotliCompress(options: BrotliOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;

  // Set default options
  const {
    extensions = ['js', 'html', 'css', 'json', 'ico', 'svg', 'wasm'],
    verbose = true,
    quality = BrotliQuality.DEFAULT,
    minSize = 1024,
    deleteOriginal = false,
    shouldCompress,
    parallel = true,
    maxParallel = 10
  } = options;

  return {
    name: 'vite-plugin-brotli-compress',

    // Hook into the resolved Vite configuration.
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    // Hook that runs after the bundle is generated and written to disk.
    async closeBundle() {
      const startTime = Date.now();
      const outDir = viteConfig.build.outDir;
      
      if (verbose) {
        console.log('\n[vite-plugin-brotli-compress] Starting Brotli compression...');
      }

      try {
        // Find all files in the output directory that match the extensions.
        const filesToCompress = await findFiles(outDir, extensions, minSize, shouldCompress);

        if (filesToCompress.length === 0) {
          if (verbose) {
            console.log('[vite-plugin-brotli-compress] No matching files found to compress.');
          }
          return;
        }

        // Compress files
        const stats = await compressFiles(filesToCompress, {
          quality,
          deleteOriginal,
          parallel,
          maxParallel,
          verbose
        });

        const timeElapsed = Date.now() - startTime;
        stats.timeElapsed = timeElapsed;

        if (verbose) {
          logCompressionResults(stats);
        }
      } catch (error) {
        console.error('[vite-plugin-brotli-compress] Error during compression:', error);
        throw error;
      }
    },
  };
}

/**
 * Interface for compression options used internally.
 */
interface CompressionOptions {
  quality: BrotliQuality | number;
  deleteOriginal: boolean;
  parallel: boolean;
  maxParallel: number;
  verbose: boolean;
}

/**
 * Recursively finds all files with given extensions in a directory.
 */
async function findFiles(
  dir: string, 
  extensions: string[], 
  minSize: number,
  shouldCompress?: (filePath: string, fileSize: number) => boolean,
  visitedDirs: Set<string> = new Set()
): Promise<string[]> {
  // Prevent infinite recursion by tracking visited directories
  if (visitedDirs.has(dir)) {
    return [];
  }
  visitedDirs.add(dir);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name);
      
      if (entry.isDirectory()) {
        try {
          const subFiles = await findFiles(fullPath, extensions, minSize, shouldCompress, visitedDirs);
          files.push(...subFiles);
        } catch (error) {
          // Skip directories that can't be accessed
          continue;
        }
      } else if (extensions.some(ext => entry.name.endsWith(`.${ext}`))) {
        try {
          const stats = fs.statSync(fullPath);
          const fileSize = stats.size;
          
          // Skip files that are too small
          if (fileSize < minSize) {
            continue;
          }
          
          // Use custom shouldCompress function if provided
          if (shouldCompress && !shouldCompress(fullPath, fileSize)) {
            continue;
          }
          
          files.push(fullPath);
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }
    }
    
    return files;
  } catch (error) {
    // Directory doesn't exist or can't be accessed
    return [];
  }
}

/**
 * Compresses multiple files with the given options.
 */
async function compressFiles(
  files: string[], 
  options: CompressionOptions
): Promise<CompressionStats> {
  const stats: CompressionStats = {
    totalFiles: files.length,
    compressedFiles: 0,
    skippedFiles: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    compressionRatio: 0,
    timeElapsed: 0
  };

  if (options.parallel) {
    // Compress files in parallel with concurrency limit
    const chunks = chunkArray(files, options.maxParallel);
    
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(filePath => compressFile(filePath, options))
      );
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          stats.compressedFiles++;
          stats.totalOriginalSize += result.value.originalSize;
          stats.totalCompressedSize += result.value.compressedSize;
        } else {
          stats.skippedFiles++;
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Failed to compress file: ${result.reason}`);
          }
        }
      }
    }
  } else {
    // Compress files sequentially
    for (const filePath of files) {
      try {
        const result = await compressFile(filePath, options);
        stats.compressedFiles++;
        stats.totalOriginalSize += result.originalSize;
        stats.totalCompressedSize += result.compressedSize;
      } catch (error) {
        stats.skippedFiles++;
        if (options.verbose) {
          console.warn(`[vite-plugin-brotli-compress] Failed to compress file ${filePath}:`, error);
        }
      }
    }
  }

  stats.compressionRatio = stats.totalOriginalSize > 0 
    ? ((stats.totalOriginalSize - stats.totalCompressedSize) / stats.totalOriginalSize) * 100 
    : 0;

  return stats;
}

/**
 * Compresses a single file using Brotli and writes it to a new .br file.
 */
function compressFile(filePath: string, options: CompressionOptions): Promise<{originalSize: number, compressedSize: number}> {
  return new Promise((resolve, reject) => {
    const compressStream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(Math.max(options.quality, 0), 11),
      },
    });

    const readStream = fs.createReadStream(filePath);
    const compressedPath = `${filePath}.br`;
    const writeStream = fs.createWriteStream(compressedPath);

    let originalSize = 0;
    let compressedSize = 0;

    readStream.on('data', (chunk) => {
      originalSize += chunk.length;
    });

    writeStream.on('data', (chunk) => {
      compressedSize += chunk.length;
    });

    readStream.pipe(compressStream).pipe(writeStream);

    writeStream.on('finish', () => {
      // Delete original file if requested
      if (options.deleteOriginal) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Failed to delete original file ${filePath}:`, error);
          }
        }
      }
      resolve({ originalSize, compressedSize });
    });

    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
}

/**
 * Splits an array into chunks of specified size.
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Logs compression results to the console.
 */
function logCompressionResults(stats: CompressionStats): void {
  console.log('\n[vite-plugin-brotli-compress] Compression Results:');
  console.log(`  Total files processed: ${stats.totalFiles}`);
  console.log(`  Successfully compressed: ${stats.compressedFiles}`);
  console.log(`  Skipped/Failed: ${stats.skippedFiles}`);
  console.log(`  Original size: ${formatBytes(stats.totalOriginalSize)}`);
  console.log(`  Compressed size: ${formatBytes(stats.totalCompressedSize)}`);
  console.log(`  Compression ratio: ${stats.compressionRatio.toFixed(2)}%`);
  console.log(`  Time elapsed: ${stats.timeElapsed}ms`);
  console.log('  ✨ Brotli compression completed!\n');
}

/**
 * Formats bytes into human-readable format.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}