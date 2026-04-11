<p align="center">
<img src="https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/blob/main/assets/riyajath-ahamed/vite-plugin-brotli-compress.svg" width="640" height="320" />
</p>

<h1 align="center">vite-plugin-brotli-compress</h1>

<p align="center">
A high-performance Vite plugin that compresses build assets using Brotli and Gzip, reducing bundle sizes by up to 80% and improving loading times.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vite-plugin-brotli-compress"><img src="https://img.shields.io/npm/v/vite-plugin-brotli-compress.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/vite-plugin-brotli-compress"><img src="https://img.shields.io/npm/dm/vite-plugin-brotli-compress.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/vite-plugin-brotli-compress"><img src="https://img.shields.io/bundlephobia/minzip/vite-plugin-brotli-compress?style=flat&colorA=18181B&colorB=28CF8D&label=minzip" alt="bundle size" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat&colorA=18181B" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat&colorA=18181B&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/vite-plugin-brotli-compress?style=flat&colorA=18181B&colorB=28CF8D" alt="node version" /></a>
  <a href="https://www.npmjs.com/package/vite-plugin-brotli-compress"><img src="https://img.shields.io/npm/types/vite-plugin-brotli-compress?style=flat&colorA=18181B&colorB=28CF8D" alt="types included" /></a>
</p>

---

## Why Compress Build Assets?

Modern web applications ship megabytes of JavaScript, CSS, and HTML. Without compression, users download the full uncompressed payload on every page load. Brotli typically achieves **15-25% better compression** than Gzip on web assets, and all modern browsers support it.

| Metric | Without Compression | With Brotli |
|--------|:-------------------:|:-----------:|
| Typical JS bundle | 500 KB | ~100 KB |
| First Contentful Paint | Slower | Faster |
| Bandwidth cost | Higher | Lower |
| Lighthouse score | Lower | Higher |

This plugin runs **after** Vite's build step. It reads the output directory, compresses matching files, and writes `.br` / `.gz` variants alongside the originals. Your web server then serves the pre-compressed files directly, avoiding on-the-fly compression overhead.

---

## Features

- **Brotli + Gzip**: Compress with Brotli, Gzip, or both simultaneously
- **Parallel Processing**: Configurable concurrency for fast builds on multi-core machines
- **Smart Filtering**: Target specific extensions, file sizes, and glob patterns
- **Compression Threshold**: Automatically discard compressed files that don't save enough space
- **Size Budgets**: Enforce per-file and total size limits; warn or fail the build when exceeded
- **Progress & Stats Callbacks**: Real-time progress reporting and final stats for CI pipelines
- **Retry Logic**: Automatic retries with exponential backoff for transient failures
- **Full TypeScript**: Exported types, enums, and interfaces with JSDoc

---

## Installation

```bash
# npm
npm install --save-dev vite-plugin-brotli-compress

# yarn
yarn add --dev vite-plugin-brotli-compress

# pnpm
pnpm add -D vite-plugin-brotli-compress
```

**Requirements**: Node.js >= 16 | Vite >= 4.0.0

---

## Quick Start

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import brotliCompress from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    brotliCompress()
  ]
})
```

That's it. Run `vite build` and check your `dist/` folder for `.br` files.

---

## Configuration

### Full Example

```typescript
import { defineConfig } from 'vite'
import brotliCompress, { BrotliQuality, CompressionType, GzipLevel } from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    brotliCompress({
      // Algorithm
      type: CompressionType.BOTH,
      quality: BrotliQuality.HIGH,
      gzipLevel: GzipLevel.DEFAULT,

      // File selection
      extensions: ['js', 'css', 'html', 'json', 'svg', 'wasm'],
      minSize: 1024,
      maxSize: 10 * 1024 * 1024,
      excludePatterns: ['**/vendor/**'],

      // Threshold — discard if savings < 5%
      compressionThreshold: 0.05,

      // Performance
      parallel: true,
      maxParallel: 10,
      skipExisting: true,

      // Size budgets
      budget: {
        maxTotalSize: 500 * 1024,
        maxFileSize: 200 * 1024,
        action: 'warn'
      },

      // Callbacks
      onProgress: ({ percentage, currentFile }) => {
        console.log(`[${percentage}%] ${currentFile}`)
      },
      onComplete: (stats) => {
        console.log(`Saved ${stats.compressionRatio.toFixed(1)}% across ${stats.compressedFiles} files`)
      },

      // Error handling
      continueOnError: true,
      retryAttempts: 2,
      errorCallback: (error, filePath) => {
        console.error(`Failed: ${filePath}`, error.message)
      },

      verbose: true
    })
  ]
})
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `CompressionType` | `BROTLI` | Algorithm: `BROTLI`, `GZIP`, or `BOTH` |
| `extensions` | `string[]` | `['js','html','css','json','ico','svg','wasm']` | File extensions to compress |
| `quality` | `number` | `6` | Brotli quality level (0-11) |
| `gzipLevel` | `number` | `6` | Gzip compression level (0-9) |
| `minSize` | `number` | `1024` | Minimum file size in bytes |
| `maxSize` | `number` | `undefined` | Maximum file size in bytes |
| `compressionThreshold` | `number` | `0` | Min savings ratio (0-1) to keep compressed file |
| `deleteOriginal` | `boolean` | `false` | Delete originals after compression |
| `shouldCompress` | `(path, size) => boolean` | `undefined` | Custom filter function |
| `excludePatterns` | `string[]` | `[]` | Glob patterns to exclude |
| `includePatterns` | `string[]` | `[]` | Glob patterns to include (overrides exclude) |
| `parallel` | `boolean` | `true` | Compress files in parallel |
| `maxParallel` | `number` | `10` | Max concurrent compressions |
| `skipExisting` | `boolean` | `false` | Skip if `.br`/`.gz` already exists |
| `continueOnError` | `boolean` | `true` | Continue if some files fail |
| `retryAttempts` | `number` | `0` | Retry count for failed compressions |
| `errorCallback` | `(error, path) => void` | `undefined` | Called on compression failure |
| `onProgress` | `(progress) => void` | `undefined` | Called per-file with progress info |
| `onComplete` | `(stats) => void` | `undefined` | Called with final compression stats |
| `budget` | `BudgetOptions` | `undefined` | Compressed output size limits |
| `verbose` | `boolean` | `true` | Log results to console |

### BudgetOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTotalSize` | `number` | `undefined` | Max total compressed bytes |
| `maxFileSize` | `number` | `undefined` | Max compressed bytes per file |
| `action` | `'warn' \| 'error'` | `'warn'` | `'error'` throws and fails the build |

### Enums

```typescript
// Compression algorithm
enum CompressionType {
  BROTLI = 'brotli',
  GZIP   = 'gzip',
  BOTH   = 'both'
}

// Brotli quality presets (0-11)
enum BrotliQuality {
  FASTEST = 0,
  FAST    = 3,
  DEFAULT = 6,
  HIGH    = 9,
  MAXIMUM = 11
}

// Gzip level presets (0-9)
enum GzipLevel {
  NONE    = 0,
  FASTEST = 1,
  FAST    = 3,
  DEFAULT = 6,
  HIGH    = 9,
  MAXIMUM = 9
}
```

---

## Quality Guide

| Quality | Speed | Ratio | Best For |
|---------|-------|-------|----------|
| 0-2 | Very fast | Low | Development / watch mode |
| 3-5 | Fast | Medium | CI/CD, frequent deploys |
| **6-8** | **Balanced** | **Good** | **Production (recommended)** |
| 9-11 | Slow | Excellent | Final release, maximum savings |

---

## Brotli vs Gzip

| | Brotli | Gzip |
|---|---|---|
| **Compression ratio** | ~15-25% better | Baseline |
| **Decompression speed** | Comparable | Comparable |
| **Browser support** | All modern browsers | Universal |
| **Best for** | Static pre-compressed assets | Broad compatibility fallback |
| **File extension** | `.br` | `.gz` |

**Recommendation**: Use `CompressionType.BOTH` in production to serve Brotli to modern browsers and fall back to Gzip for older clients.

---

## Examples

### React + TypeScript

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import brotliCompress from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    react(),
    brotliCompress({
      quality: 9,
      minSize: 2048,
      compressionThreshold: 0.05
    })
  ]
})
```

### Vue

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import brotliCompress, { CompressionType } from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    vue(),
    brotliCompress({
      type: CompressionType.BOTH,
      quality: 9,
      gzipLevel: 6
    })
  ]
})
```

### Svelte

```typescript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import brotliCompress from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    svelte(),
    brotliCompress({ quality: 9 })
  ]
})
```

### Environment-Aware Configuration

```typescript
brotliCompress({
  // Lower quality for faster dev builds
  quality: process.env.NODE_ENV === 'production' ? 9 : 3,

  // Fewer parallel workers in CI
  maxParallel: process.env.CI ? 4 : 10,

  // Skip tiny files during development
  minSize: process.env.NODE_ENV === 'production' ? 1024 : 10240,

  // Only enforce budgets in CI
  budget: process.env.CI ? {
    maxTotalSize: 500 * 1024,
    action: 'error'
  } : undefined
})
```

### Custom File Filtering

```typescript
brotliCompress({
  shouldCompress: (filePath, fileSize) => {
    // Skip vendor files
    if (filePath.includes('vendor')) return false

    // Skip already compressed formats
    if (filePath.endsWith('.br') || filePath.endsWith('.gz')) return false

    // Only compress files larger than 2 KB
    return fileSize > 2048
  }
})
```

### Compression Threshold

```typescript
brotliCompress({
  // Discard compressed files that don't save at least 5%
  // Prevents bloat from files that are already compact (e.g. tiny icons)
  compressionThreshold: 0.05,
  verbose: true
})
```

### Progress & Stats Callbacks

```typescript
import fs from 'fs'

brotliCompress({
  // Real-time progress — useful in CI logs
  onProgress: ({ currentFile, currentIndex, totalFiles, percentage }) => {
    console.log(`[${percentage}%] Compressing ${currentFile} (${currentIndex + 1}/${totalFiles})`)
  },

  // Final stats — pipe to dashboards, write manifests, or fail CI
  onComplete: (stats) => {
    console.log(`Compressed ${stats.compressedFiles} files, saved ${stats.compressionRatio.toFixed(1)}%`)
    console.log(`Skipped: ${stats.skippedFiles} | Failed: ${stats.failedFiles}`)

    // Write a compression manifest for CI
    fs.writeFileSync(
      'compression-report.json',
      JSON.stringify(stats.fileDetails, null, 2)
    )
  }
})
```

### Size Budgets

```typescript
brotliCompress({
  budget: {
    maxTotalSize: 500 * 1024, // 500 KB total compressed output
    maxFileSize: 200 * 1024,  // 200 KB max per compressed file
    action: 'error'           // fail the build if exceeded
  }
})
```

### Working Example

A complete working example is included in the `example/` directory:

```bash
cd example
npm install
npm run build
# Check the dist/ folder for .br compressed files
```

---

## Server Configuration

Pre-compressed files need your web server configured to serve them.

### Nginx

```nginx
# Enable Brotli static serving
location ~* \.(js|css|html|json|svg|wasm)$ {
    brotli_static on;
    gzip_static on;

    # Fallback for servers without brotli_static module
    # try_files $uri.br $uri.gz $uri =404;
    # add_header Content-Encoding br;
    # add_header Vary Accept-Encoding;
}
```

### Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Serve Brotli if supported
    RewriteCond %{HTTP:Accept-Encoding} br
    RewriteCond %{REQUEST_FILENAME}\.br -f
    RewriteRule ^(.*)$ $1.br [QSA,L]

    # Serve Gzip as fallback
    RewriteCond %{HTTP:Accept-Encoding} gzip
    RewriteCond %{REQUEST_FILENAME}\.gz -f
    RewriteRule ^(.*)$ $1.gz [QSA,L]

    <FilesMatch "\.br$">
        Header set Content-Encoding br
        Header set Vary Accept-Encoding
    </FilesMatch>

    <FilesMatch "\.gz$">
        Header set Content-Encoding gzip
        Header set Vary Accept-Encoding
    </FilesMatch>
</IfModule>
```

### Vercel / Netlify / Cloudflare Pages

These platforms automatically serve Brotli-compressed assets if `.br` files exist alongside the originals. No extra configuration needed - just deploy your `dist/` folder.

---

## How It Works

```
vite build
    |
    v
[ Vite outputs dist/ ]
    |
    v
[ Plugin scans dist/ for matching files ]
    |
    v
[ Filters by extension, size, patterns, shouldCompress() ]
    |
    v
[ Compresses in parallel (configurable concurrency) ]
    |
    v
[ Applies threshold check — discards if savings too low ]
    |
    v
[ Checks budget limits — warns or errors ]
    |
    v
[ Calls onProgress per file, onComplete with final stats ]
    |
    v
[ dist/app.js.br, dist/app.js.gz ready to serve ]
```

---

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run with UI
npm run test:ui

# Run a specific suite
npm test -- --grep "integration"
npm test -- --grep "v1.3.0"
```

---

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) and submit pull requests.

```bash
git clone https://github.com/riyajath-ahamed/vite-plugin-brotli-compress.git
cd vite-plugin-brotli-compress
npm install
npm test
npm run build
```

---

## License

[MIT](LICENSE)

---

## Changelog

### v1.3.0
- **Compression Threshold**: Discard compressed files that don't meet a minimum savings ratio (`compressionThreshold`)
- **Progress Callback**: Real-time `onProgress` callback with file name, index, total, and percentage
- **Stats Callback**: `onComplete` callback providing full `CompressionStats` including per-file `fileDetails`
- **Size Budgets**: `budget` option with `maxTotalSize`, `maxFileSize`, and `action` (`'warn'` or `'error'`) to enforce compressed output limits
- **Bug Fix**: Fixed compressed file size tracking (was always reporting 0 due to incorrect stream event listener)
- No breaking changes - fully backward compatible

### v1.1.0
- Added Gzip compression support alongside Brotli
- Enhanced file filtering with glob patterns (`excludePatterns`, `includePatterns`)
- Better error handling with retry logic and error callbacks
- Performance improvements with `skipExisting` option
- Support for maximum file size limits
- Enhanced compression statistics reporting
- No breaking changes - fully backward compatible

### v1.0.0
- Initial release
- Brotli compression with configurable quality
- Parallel processing, smart filtering, comprehensive test suite
- TypeScript support with full type definitions
- **Vite compatibility**: v4.0.0 through v7.x.x

---

<p align="center">
  <a href="https://github.com/riyajath-ahamed/vite-plugin-brotli-compress">GitHub</a> &middot;
  <a href="https://www.npmjs.com/package/vite-plugin-brotli-compress">npm</a> &middot;
  <a href="https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/issues">Issues</a> &middot;
  <a href="https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/discussions">Discussions</a>
</p>
