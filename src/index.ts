import type { Plugin, ResolvedConfig } from "vite";
import path from "path";
import fs from "fs";
import zlib from "zlib";
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
}
/**
 * The main plugin function.
 */
export default function brotliCompress(options: BrotliOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;
  // Set default options
  const {
    extensions = ["js", "html", "css", "json", "ico", "svg", "wasm"],
    verbose = true,
  } = options;

  return {
    name: "vite-plugin-brotli-compress",
    // Hook into the resolved Vite configuration.
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },
    // Hook that runs after the bundle is generated and written to disk.
    async closeBundle() {
      const outDir = viteConfig.build.outDir;
      if (verbose) {
        console.log(
          "\n[vite-plugin-brotli-compress] Starting Brotli compression..."
        );
      }
      // Find all files in the output directory that match the extensions.
      const filesToCompress = findFiles(outDir, extensions);
      if (filesToCompress.length === 0) {
        if (verbose) {
          console.log(
            "[vite-plugin-brotli-compress] No matching files found to compress."
          );
        }
        return;
      }
      // Compress all found files in parallel.
      await Promise.all(
        filesToCompress.map((filePath) => compressFile(filePath))
      );
      if (verbose) {
        console.log(
          `[vite-plugin-brotli-compress] Compressed ${filesToCompress.length} files. ✨`
        );
      }
    },
  };
}
/**
 * Recursively finds all files with given extensions in a directory.
 */
function findFiles(dir: string, extensions: string[]): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const fullPath = path.resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return findFiles(fullPath, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(`.${ext}`))) {
      return [fullPath];
    }
    return [];
  });
  return files;
}
/**
 * Compresses a single file using Brotli and writes it to a new .br file.
 */
function compressFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const compressStream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]:
          zlib.constants.BROTLI_MAX_QUALITY,
      },
    });
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(`${filePath}.br`);
    readStream.pipe(compressStream).pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    readStream.on("error", reject);
  });
}
