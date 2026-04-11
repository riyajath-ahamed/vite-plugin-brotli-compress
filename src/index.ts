import type { Plugin, ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

/**
 * Compression algorithms supported by the plugin.
 */
export enum CompressionType {
  /** Brotli compression only */
  BROTLI = 'brotli',
  /** Gzip compression only */
  GZIP = 'gzip',
  /** Both Brotli and Gzip compression */
  BOTH = 'both'
}

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
 * Gzip compression levels.
 */
export enum GzipLevel {
  /** No compression */
  NONE = 0,
  /** Fastest compression */
  FASTEST = 1,
  /** Fast compression */
  FAST = 3,
  /** Default compression */
  DEFAULT = 6,
  /** High compression */
  HIGH = 9,
  /** Maximum compression */
  MAXIMUM = 9
}

/**
 * Interface for plugin options.
 */
export interface BrotliOptions {
  /**
   * Compression type to use.
   * @default CompressionType.BROTLI
   */
  type?: CompressionType;
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
   * Brotli compression quality level (0-11).
   * @default BrotliQuality.DEFAULT (6)
   */
  quality?: BrotliQuality | number;
  /**
   * Gzip compression level (0-9).
   * @default GzipLevel.DEFAULT (6)
   */
  gzipLevel?: GzipLevel | number;
  /**
   * Minimum file size in bytes to compress (files smaller than this will be skipped).
   * @default 1024 (1KB)
   */
  minSize?: number;
  /**
   * Maximum file size in bytes to compress (files larger than this will be skipped).
   * @default undefined (no limit)
   */
  maxSize?: number;
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
   * Glob patterns to exclude from compression.
   * @default []
   */
  excludePatterns?: string[];
  /**
   * Glob patterns to include for compression (overrides excludePatterns).
   * @default []
   */
  includePatterns?: string[];
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
  /**
   * Whether to skip compression if compressed file already exists.
   * @default false
   */
  skipExisting?: boolean;
  /**
   * Whether to continue compression if some files fail.
   * @default true
   */
  continueOnError?: boolean;
  /**
   * Number of retry attempts for failed compressions.
   * @default 0
   */
  retryAttempts?: number;
  /**
   * Callback function called when compression fails.
   * @param error - The error that occurred
   * @param filePath - The file path that failed
   */
  errorCallback?: (error: Error, filePath: string) => void;
  /**
   * Minimum compression ratio (0-1) required to keep the compressed file.
   * If the compressed file is not at least this much smaller than the original,
   * it will be discarded. For example, 0.05 means the compressed file must be
   * at least 5% smaller than the original.
   * @default 0 (keep all compressed files)
   */
  compressionThreshold?: number;
  /**
   * Callback function called for each file as compression progresses.
   * @param progress - Progress information including current file, index, total, and percentage
   */
  onProgress?: (progress: CompressionProgress) => void;
  /**
   * Callback function called when all compression is complete.
   * @param stats - Final compression statistics
   */
  onComplete?: (stats: CompressionStats) => void;
  /**
   * Size budget configuration. Warns or errors if compressed output exceeds limits.
   */
  budget?: BudgetOptions;
}

/**
 * Size budget options for enforcing compressed output limits.
 */
export interface BudgetOptions {
  /**
   * Maximum total compressed size in bytes for all files combined.
   */
  maxTotalSize?: number;
  /**
   * Maximum compressed size in bytes for any single file.
   */
  maxFileSize?: number;
  /**
   * Action to take when budget is exceeded.
   * - 'warn': Log a warning (default)
   * - 'error': Throw an error to fail the build
   * @default 'warn'
   */
  action?: 'warn' | 'error';
}

/**
 * Compression statistics for reporting.
 */
export interface CompressionStats {
  totalFiles: number;
  compressedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  timeElapsed: number;
  brotliFiles?: number;
  gzipFiles?: number;
  /** Per-file compression details for budget checks and reporting. */
  fileDetails: FileCompressionDetail[];
}

/**
 * Per-file compression detail.
 */
export interface FileCompressionDetail {
  filePath: string;
  originalSize: number;
  compressedSize: number;
  algorithm: 'brotli' | 'gzip';
}

/**
 * Progress information for compression operations.
 */
export interface CompressionProgress {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  percentage: number;
}

/**
 * Simple glob pattern matching function.
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  
  return patterns.some(pattern => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any chars except /
      .replace(/\?/g, '.')     // ? matches single char
      .replace(/\./g, '\\.');   // Escape dots
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  });
}

/**
 * Determines if a file should be compressed based on patterns and size.
 */
function shouldCompressFile(
  filePath: string, 
  fileSize: number, 
  minSize: number, 
  maxSize: number | undefined,
  excludePatterns: string[],
  includePatterns: string[],
  shouldCompress?: (filePath: string, fileSize: number) => boolean
): boolean {
  // Check file size limits
  if (fileSize < minSize) return false;
  if (maxSize && fileSize > maxSize) return false;
  
  // Check include patterns first (they override exclude patterns)
  if (includePatterns.length > 0) {
    return matchesPattern(filePath, includePatterns);
  }
  
  // Check exclude patterns
  if (excludePatterns.length > 0 && matchesPattern(filePath, excludePatterns)) {
    return false;
  }
  
  // Use custom shouldCompress function if provided
  if (shouldCompress) {
    return shouldCompress(filePath, fileSize);
  }
  
  return true;
}

/**
 * Checks if a compressed file already exists.
 */
function compressedFileExists(filePath: string, type: CompressionType): boolean {
  if (type === CompressionType.BROTLI || type === CompressionType.BOTH) {
    if (fs.existsSync(`${filePath}.br`)) return true;
  }
  if (type === CompressionType.GZIP || type === CompressionType.BOTH) {
    if (fs.existsSync(`${filePath}.gz`)) return true;
  }
  return false;
}

/**
 * The main plugin function.
 */
export default function brotliCompress(options: BrotliOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;

  // Set default options
  const {
    type = CompressionType.BROTLI,
    extensions = ['js', 'html', 'css', 'json', 'ico', 'svg', 'wasm'],
    verbose = true,
    quality = BrotliQuality.DEFAULT,
    gzipLevel = GzipLevel.DEFAULT,
    minSize = 1024,
    maxSize,
    deleteOriginal = false,
    shouldCompress,
    excludePatterns = [],
    includePatterns = [],
    parallel = true,
    maxParallel = 10,
    skipExisting = false,
    continueOnError = true,
    retryAttempts = 0,
    errorCallback,
    compressionThreshold = 0,
    onProgress,
    onComplete,
    budget
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
        const compressionType = type === CompressionType.BOTH ? 'Brotli and Gzip' : 
                               type === CompressionType.GZIP ? 'Gzip' : 'Brotli';
        console.log(`\n[vite-plugin-brotli-compress] Starting ${compressionType} compression...`);
      }

      try {
        // Find all files in the output directory that match the extensions.
        const filesToCompress = await findFiles(
          outDir, 
          extensions, 
          minSize, 
          maxSize,
          excludePatterns,
          includePatterns,
          shouldCompress,
          skipExisting,
          type
        );

        if (filesToCompress.length === 0) {
          if (verbose) {
            console.log('[vite-plugin-brotli-compress] No matching files found to compress.');
          }
          return;
        }

        // Compress files
        const stats = await compressFiles(filesToCompress, {
          type,
          quality,
          gzipLevel,
          deleteOriginal,
          parallel,
          maxParallel,
          verbose,
          continueOnError,
          retryAttempts,
          errorCallback,
          compressionThreshold,
          onProgress
        });

        const timeElapsed = Date.now() - startTime;
        stats.timeElapsed = timeElapsed;

        if (verbose) {
          logCompressionResults(stats, type);
        }

        // Check size budget
        if (budget) {
          checkBudget(stats, budget);
        }

        // Call onComplete callback
        if (onComplete) {
          onComplete(stats);
        }
      } catch (error) {
        console.error('[vite-plugin-brotli-compress] Error during compression:', error);
        if (!continueOnError) {
          throw error;
        }
      }
    },
  };
}

/**
 * Interface for compression options used internally.
 */
interface CompressionOptions {
  type: CompressionType;
  quality: BrotliQuality | number;
  gzipLevel: GzipLevel | number;
  deleteOriginal: boolean;
  parallel: boolean;
  maxParallel: number;
  verbose: boolean;
  continueOnError: boolean;
  retryAttempts: number;
  errorCallback?: (error: Error, filePath: string) => void;
  compressionThreshold: number;
  onProgress?: (progress: CompressionProgress) => void;
}

/**
 * Recursively finds all files with given extensions in a directory.
 */
async function findFiles(
  dir: string, 
  extensions: string[], 
  minSize: number,
  maxSize: number | undefined,
  excludePatterns: string[],
  includePatterns: string[],
  shouldCompress?: (filePath: string, fileSize: number) => boolean,
  skipExisting: boolean = false,
  type: CompressionType = CompressionType.BROTLI,
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
          const subFiles = await findFiles(
            fullPath, 
            extensions, 
            minSize, 
            maxSize,
            excludePatterns,
            includePatterns,
            shouldCompress,
            skipExisting,
            type,
            visitedDirs
          );
          files.push(...subFiles);
        } catch (error) {
          // Skip directories that can't be accessed
          continue;
        }
      } else if (extensions.some(ext => entry.name.endsWith(`.${ext}`))) {
        try {
          const stats = fs.statSync(fullPath);
          const fileSize = stats.size;
          
          // Check if file should be compressed
          if (!shouldCompressFile(
            fullPath, 
            fileSize, 
            minSize, 
            maxSize,
            excludePatterns,
            includePatterns,
            shouldCompress
          )) {
            continue;
          }
          
          // Skip if compressed file already exists
          if (skipExisting && compressedFileExists(fullPath, type)) {
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
 * Internal per-file compression result.
 */
interface FileCompressResult {
  compressedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  brotliFiles?: number;
  gzipFiles?: number;
  fileDetails: FileCompressionDetail[];
}

/**
 * Merges a single file result into the accumulated stats.
 */
function mergeFileResult(stats: CompressionStats, result: FileCompressResult): void {
  stats.compressedFiles += result.compressedFiles;
  stats.failedFiles += result.failedFiles;
  stats.skippedFiles += result.skippedFiles;
  stats.totalOriginalSize += result.totalOriginalSize;
  stats.totalCompressedSize += result.totalCompressedSize;
  stats.brotliFiles = (stats.brotliFiles || 0) + (result.brotliFiles || 0);
  stats.gzipFiles = (stats.gzipFiles || 0) + (result.gzipFiles || 0);
  stats.fileDetails.push(...result.fileDetails);
}

/**
 * Emits a progress callback if configured.
 */
function emitProgress(
  options: CompressionOptions,
  filePath: string,
  currentIndex: number,
  totalFiles: number
): void {
  if (options.onProgress) {
    options.onProgress({
      currentFile: filePath,
      currentIndex,
      totalFiles,
      percentage: Math.round(((currentIndex + 1) / totalFiles) * 100)
    });
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
    failedFiles: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    compressionRatio: 0,
    timeElapsed: 0,
    brotliFiles: 0,
    gzipFiles: 0,
    fileDetails: []
  };

  let processedIndex = 0;

  if (options.parallel) {
    // Compress files in parallel with concurrency limit
    const chunks = chunkArray(files, options.maxParallel);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(filePath => compressFileWithRetry(filePath, options))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          mergeFileResult(stats, result.value);
        } else {
          stats.failedFiles++;
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Failed to compress file: ${result.reason}`);
          }
        }
        emitProgress(options, files[processedIndex], processedIndex, files.length);
        processedIndex++;
      }
    }
  } else {
    // Compress files sequentially
    for (const filePath of files) {
      try {
        const result = await compressFileWithRetry(filePath, options);
        mergeFileResult(stats, result);
      } catch (error) {
        stats.failedFiles++;
        if (options.verbose) {
          console.warn(`[vite-plugin-brotli-compress] Failed to compress file ${filePath}:`, error);
        }
        if (options.errorCallback) {
          options.errorCallback(error as Error, filePath);
        }
      }
      emitProgress(options, filePath, processedIndex, files.length);
      processedIndex++;
    }
  }

  stats.compressionRatio = stats.totalOriginalSize > 0
    ? ((stats.totalOriginalSize - stats.totalCompressedSize) / stats.totalOriginalSize) * 100
    : 0;

  return stats;
}

/**
 * Compresses a file with retry logic.
 */
async function compressFileWithRetry(
  filePath: string,
  options: CompressionOptions
): Promise<FileCompressResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.retryAttempts; attempt++) {
    try {
      return await compressFile(filePath, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < options.retryAttempts) {
        if (options.verbose) {
          console.warn(`[vite-plugin-brotli-compress] Retry ${attempt + 1}/${options.retryAttempts} for ${filePath}`);
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  // All retries failed
  if (options.errorCallback) {
    options.errorCallback(lastError!, filePath);
  }
  throw lastError;
}

/**
 * Checks if a compressed file meets the compression threshold.
 * If not, deletes the compressed file and returns false.
 */
function meetsThreshold(
  originalSize: number,
  compressedSize: number,
  threshold: number,
  compressedPath: string,
  verbose: boolean
): boolean {
  if (threshold <= 0 || originalSize === 0) return true;

  const ratio = (originalSize - compressedSize) / originalSize;
  if (ratio < threshold) {
    // Compressed file doesn't save enough — discard it
    try {
      fs.unlinkSync(compressedPath);
    } catch {
      // ignore cleanup errors
    }
    if (verbose) {
      console.log(
        `[vite-plugin-brotli-compress] Skipped ${compressedPath} (ratio ${(ratio * 100).toFixed(1)}% < threshold ${(threshold * 100).toFixed(1)}%)`
      );
    }
    return false;
  }
  return true;
}

/**
 * Compresses a single file using Brotli and/or Gzip.
 */
function compressFile(
  filePath: string,
  options: CompressionOptions
): Promise<FileCompressResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const results: FileCompressResult = {
        compressedFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        brotliFiles: 0,
        gzipFiles: 0,
        fileDetails: []
      };

      // Get original file size
      const stats = fs.statSync(filePath);
      results.totalOriginalSize = stats.size;

      // Compress with Brotli if requested
      if (options.type === CompressionType.BROTLI || options.type === CompressionType.BOTH) {
        try {
          const brotliResult = await compressWithBrotli(filePath, options);
          const compressedPath = `${filePath}.br`;

          if (meetsThreshold(stats.size, brotliResult.compressedSize, options.compressionThreshold, compressedPath, options.verbose)) {
            results.compressedFiles++;
            results.totalCompressedSize += brotliResult.compressedSize;
            results.brotliFiles = 1;
            results.fileDetails.push({
              filePath: compressedPath,
              originalSize: stats.size,
              compressedSize: brotliResult.compressedSize,
              algorithm: 'brotli'
            });
          } else {
            results.skippedFiles++;
          }
        } catch (error) {
          results.failedFiles++;
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Brotli compression failed for ${filePath}:`, error);
          }
        }
      }

      // Compress with Gzip if requested
      if (options.type === CompressionType.GZIP || options.type === CompressionType.BOTH) {
        try {
          const gzipResult = await compressWithGzip(filePath, options);
          const compressedPath = `${filePath}.gz`;

          if (meetsThreshold(stats.size, gzipResult.compressedSize, options.compressionThreshold, compressedPath, options.verbose)) {
            results.compressedFiles++;
            results.totalCompressedSize += gzipResult.compressedSize;
            results.gzipFiles = 1;
            results.fileDetails.push({
              filePath: compressedPath,
              originalSize: stats.size,
              compressedSize: gzipResult.compressedSize,
              algorithm: 'gzip'
            });
          } else {
            results.skippedFiles++;
          }
        } catch (error) {
          results.failedFiles++;
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Gzip compression failed for ${filePath}:`, error);
          }
        }
      }

      // Delete original file if requested and at least one compression succeeded
      if (options.deleteOriginal && results.compressedFiles > 0) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          if (options.verbose) {
            console.warn(`[vite-plugin-brotli-compress] Failed to delete original file ${filePath}:`, error);
          }
        }
      }

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Compresses a file using Brotli.
 */
function compressWithBrotli(filePath: string, options: CompressionOptions): Promise<{compressedSize: number}> {
  return new Promise((resolve, reject) => {
    const compressStream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(Math.max(options.quality, 0), 11),
      },
    });

    const readStream = fs.createReadStream(filePath);
    const compressedPath = `${filePath}.br`;
    const writeStream = fs.createWriteStream(compressedPath);

    readStream.pipe(compressStream).pipe(writeStream);

    writeStream.on('finish', () => {
      try {
        const compressedSize = fs.statSync(compressedPath).size;
        resolve({ compressedSize });
      } catch (error) {
        reject(error);
      }
    });

    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
}

/**
 * Compresses a file using Gzip.
 */
function compressWithGzip(filePath: string, options: CompressionOptions): Promise<{compressedSize: number}> {
  return new Promise((resolve, reject) => {
    const compressStream = zlib.createGzip({
      level: Math.min(Math.max(options.gzipLevel, 0), 9),
    });

    const readStream = fs.createReadStream(filePath);
    const compressedPath = `${filePath}.gz`;
    const writeStream = fs.createWriteStream(compressedPath);

    readStream.pipe(compressStream).pipe(writeStream);

    writeStream.on('finish', () => {
      try {
        const compressedSize = fs.statSync(compressedPath).size;
        resolve({ compressedSize });
      } catch (error) {
        reject(error);
      }
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
 * Checks compressed output against budget limits.
 * Warns or throws based on the configured action.
 */
function checkBudget(stats: CompressionStats, budget: BudgetOptions): void {
  const action = budget.action || 'warn';
  const violations: string[] = [];

  // Check total compressed size
  if (budget.maxTotalSize !== undefined && stats.totalCompressedSize > budget.maxTotalSize) {
    violations.push(
      `Total compressed size ${formatBytes(stats.totalCompressedSize)} exceeds budget of ${formatBytes(budget.maxTotalSize)}`
    );
  }

  // Check per-file compressed size
  if (budget.maxFileSize !== undefined) {
    for (const detail of stats.fileDetails) {
      if (detail.compressedSize > budget.maxFileSize) {
        violations.push(
          `${detail.filePath} (${formatBytes(detail.compressedSize)}) exceeds per-file budget of ${formatBytes(budget.maxFileSize)}`
        );
      }
    }
  }

  if (violations.length === 0) return;

  const header = '[vite-plugin-brotli-compress] Budget exceeded:';
  const message = `${header}\n${violations.map(v => `  - ${v}`).join('\n')}`;

  if (action === 'error') {
    throw new Error(message);
  }

  // action === 'warn'
  console.warn(message);
}

/**
 * Logs compression results to the console.
 */
function logCompressionResults(stats: CompressionStats, type: CompressionType): void {
  console.log('\n[vite-plugin-brotli-compress] Compression Results:');
  console.log(`  Total files processed: ${stats.totalFiles}`);
  console.log(`  Successfully compressed: ${stats.compressedFiles}`);
  console.log(`  Skipped: ${stats.skippedFiles}`);
  console.log(`  Failed: ${stats.failedFiles}`);
  
  if (type === CompressionType.BOTH) {
    console.log(`  Brotli files: ${stats.brotliFiles || 0}`);
    console.log(`  Gzip files: ${stats.gzipFiles || 0}`);
  }
  
  console.log(`  Original size: ${formatBytes(stats.totalOriginalSize)}`);
  console.log(`  Compressed size: ${formatBytes(stats.totalCompressedSize)}`);
  console.log(`  Compression ratio: ${stats.compressionRatio.toFixed(2)}%`);
  console.log(`  Time elapsed: ${stats.timeElapsed}ms`);
  
  const compressionType = type === CompressionType.BOTH ? 'Brotli and Gzip' : 
                         type === CompressionType.GZIP ? 'Gzip' : 'Brotli';
  console.log(`  ✨ ${compressionType} compression completed!\n`);
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