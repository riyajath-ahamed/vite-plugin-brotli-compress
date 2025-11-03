<p align="center">
<img src="https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/blob/main/assets/riyajath-ahamed/vite-plugin-brotli-compress.svg" width="640" height="320" />
</p>

# vite-plugin-brotli-compress
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A high-performance Vite plugin that compresses build assets using Brotli compression algorithm. This plugin automatically compresses your JavaScript, CSS, HTML, and other assets after the build process, reducing bundle sizes and improving loading times.

## Features

- 🚀 **High Performance**: Parallel compression with configurable concurrency limits
- 🎯 **Smart Filtering**: Compress only files with specified extensions and minimum sizes
- ⚙️ **Flexible Configuration**: Customizable compression quality, file filtering, and processing options
- 📊 **Detailed Reporting**: Comprehensive compression statistics and progress logging
- 🛡️ **Error Handling**: Robust error handling with graceful fallbacks
- 🔧 **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- 🧪 **Well Tested**: Extensive test suite with unit, integration, and performance tests

## Installation

```bash
npm install --save-dev vite-plugin-brotli-compress
```

## Usage

### Basic Usage

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

### Advanced Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import brotliCompress, { BrotliQuality, CompressionType, GzipLevel } from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    brotliCompress({
      // Compression type: Brotli, Gzip, or Both
      type: CompressionType.BOTH,
      
      // File extensions to compress
      extensions: ['js', 'css', 'html', 'json', 'svg', 'wasm'],
      
      // Brotli compression quality (0-11)
      quality: BrotliQuality.HIGH,
      
      // Gzip compression level (0-9)
      gzipLevel: GzipLevel.DEFAULT,
      
      // File size limits
      minSize: 1024,
      maxSize: 10 * 1024 * 1024, // 10MB
      
      // File filtering with glob patterns
      excludePatterns: ['**/vendor/**', '**/node_modules/**'],
      includePatterns: ['**/src/**', '**/assets/**'],
      
      // Whether to delete original files after compression
      deleteOriginal: false,
      
      // Custom function to determine if a file should be compressed
      shouldCompress: (filePath, fileSize) => {
        // Skip files in specific directories
        if (filePath.includes('/vendor/')) return false
        // Only compress files larger than 2KB
        return fileSize > 2048
      },
      
      // Performance options
      parallel: true,
      maxParallel: 10,
      skipExisting: true, // Skip if compressed file already exists
      
      // Error handling
      continueOnError: true,
      retryAttempts: 2,
      errorCallback: (error, filePath) => {
        console.error(`Failed to compress ${filePath}:`, error)
      },
      
      // Verbose logging
      verbose: true
    })
  ]
})
```

## Configuration Options

### BrotliOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `CompressionType` | `CompressionType.BROTLI` | Compression algorithm to use (BROTLI, GZIP, BOTH) |
| `extensions` | `string[]` | `['js', 'html', 'css', 'json', 'ico', 'svg', 'wasm']` | File extensions to compress |
| `verbose` | `boolean` | `true` | Whether to log compression results |
| `quality` | `BrotliQuality \| number` | `BrotliQuality.DEFAULT` | Brotli compression quality (0-11) |
| `gzipLevel` | `GzipLevel \| number` | `GzipLevel.DEFAULT` | Gzip compression level (0-9) |
| `minSize` | `number` | `1024` | Minimum file size in bytes to compress |
| `maxSize` | `number` | `undefined` | Maximum file size in bytes to compress |
| `deleteOriginal` | `boolean` | `false` | Whether to delete original files after compression |
| `shouldCompress` | `function` | `undefined` | Custom function to determine if a file should be compressed |
| `excludePatterns` | `string[]` | `[]` | Glob patterns to exclude from compression |
| `includePatterns` | `string[]` | `[]` | Glob patterns to include for compression |
| `parallel` | `boolean` | `true` | Whether to compress files in parallel |
| `maxParallel` | `number` | `10` | Maximum number of parallel compression operations |
| `skipExisting` | `boolean` | `false` | Whether to skip compression if compressed file already exists |
| `continueOnError` | `boolean` | `true` | Whether to continue compression if some files fail |
| `retryAttempts` | `number` | `0` | Number of retry attempts for failed compressions |
| `errorCallback` | `function` | `undefined` | Callback function called when compression fails |

### CompressionType Enum

```typescript
enum CompressionType {
  BROTLI = 'brotli',  // Brotli compression only
  GZIP = 'gzip',      // Gzip compression only
  BOTH = 'both'       // Both Brotli and Gzip compression
}
```

### BrotliQuality Enum

```typescript
enum BrotliQuality {
  FASTEST = 0,    // Fastest compression, lowest quality
  FAST = 3,       // Fast compression
  DEFAULT = 6,    // Default compression
  HIGH = 9,       // High quality compression
  MAXIMUM = 11    // Maximum quality compression
}
```

### GzipLevel Enum

```typescript
enum GzipLevel {
  NONE = 0,       // No compression
  FASTEST = 1,    // Fastest compression
  FAST = 3,       // Fast compression
  DEFAULT = 6,    // Default compression
  HIGH = 9,       // High compression
  MAXIMUM = 9     // Maximum compression
}
```

## Compression Quality Guide

| Quality | Speed | Compression Ratio | Use Case |
|---------|-------|------------------|----------|
| 0-2 | Very Fast | Low | Development builds, quick iterations |
| 3-5 | Fast | Medium | CI/CD pipelines, frequent deployments |
| 6-8 | Balanced | Good | Production builds (recommended) |
| 9-11 | Slow | Excellent | Final production builds, maximum optimization |

## Examples

### React + TypeScript Project

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import brotliCompress from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    react(),
    brotliCompress({
      extensions: ['js', 'css', 'html'],
      quality: 9,
      minSize: 2048,
      verbose: true
    })
  ],
  build: {
    outDir: 'dist'
  }
})
```

### Working Example

A complete working example is included in the `example/` directory. To try it out:

```bash
cd example
npm install
npm run build
# Check the dist/ folder for .br compressed files
```

### Custom File Filtering

```typescript
brotliCompress({
  shouldCompress: (filePath, fileSize) => {
    // Skip vendor files
    if (filePath.includes('node_modules') || filePath.includes('vendor')) {
      return false
    }
    
    // Skip small files
    if (fileSize < 2048) {
      return false
    }
    
    // Skip already compressed files
    if (filePath.endsWith('.br') || filePath.endsWith('.gz')) {
      return false
    }
    
    return true
  }
})
```

### Performance Optimization

```typescript
brotliCompress({
  // Use lower quality for faster builds during development
  quality: process.env.NODE_ENV === 'development' ? 3 : 9,
  
  // Adjust parallelism based on system capabilities
  maxParallel: process.env.CI ? 4 : 10,
  
  // Skip compression for small files in development
  minSize: process.env.NODE_ENV === 'development' ? 10240 : 1024
})
```

## Server Configuration

To serve compressed files, configure your web server to check for `.br` files:

### Nginx

```nginx
location ~* \.(js|css|html|json|svg|wasm)$ {
    # Try to serve compressed version first
    try_files $uri$suffix.br $uri =404;
    
    # Set appropriate headers
    add_header Content-Encoding br;
    add_header Vary Accept-Encoding;
}
```

### Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Check for compressed version
    RewriteCond %{HTTP:Accept-Encoding} br
    RewriteCond %{REQUEST_FILENAME}\.br -f
    RewriteRule ^(.*)$ $1.br [QSA,L]
    
    # Set content encoding
    <FilesMatch "\.br$">
        Header set Content-Encoding br
        Header set Vary Accept-Encoding
    </FilesMatch>
</IfModule>
```

## Performance Impact

The plugin is designed to be efficient and has minimal impact on build times:

- **Parallel Processing**: Files are compressed in parallel with configurable concurrency limits
- **Smart Filtering**: Only processes files that meet size and extension criteria
- **Memory Efficient**: Uses streaming compression to handle large files without memory issues
- **Fast Compression**: Optimized compression settings balance speed and compression ratio

## Testing

The plugin includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- --grep "integration"
npm test -- --grep "performance"
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/vite-plugin-brotli-compress.git

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.1.0
- ✨ **New Features:**
  - Added Gzip compression support alongside Brotli
  - Enhanced file filtering with glob patterns (excludePatterns, includePatterns)
  - Better error handling with retry logic and error callbacks
  - Performance improvements with skipExisting option
  - Support for maximum file size limits
  - Enhanced compression statistics reporting
- 🔧 **Improvements:**
  - Improved error handling and recovery
  - Better parallel processing with configurable concurrency
  - Enhanced logging with compression type information
  - More flexible configuration options
- ⚠️ **Breaking Changes:** None - fully backward compatible

### v1.0.0
- Initial release
- Basic Brotli compression functionality
- Configurable options and quality settings
- Comprehensive test suite
- TypeScript support
- **Vite compatibility**: Supports Vite v4.0.0 through v7.x.x

## Support

- 📖 [Documentation](https://github.com/riyajath-ahamed/vite-plugin-brotli-compress?tab=readme-ov-file)
- 🐛 [Issue Tracker](https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/issues)
- 💬 [Discussions](https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/discussions)

