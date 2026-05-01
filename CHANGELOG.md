# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-04-15

### Added

- Compression threshold: discard compressed files that don't meet a minimum savings ratio (`compressionThreshold`)
- Progress callback: real-time `onProgress` callback with file name, index, total, and percentage
- Stats callback: `onComplete` callback providing full `CompressionStats` including per-file `fileDetails`
- Size budgets: `budget` option with `maxTotalSize`, `maxFileSize`, and `action` (`'warn'` or `'error'`) to enforce compressed output limits

### Fixed

- Compressed file size tracking was always reporting 0 due to incorrect stream event listener

## [1.1.0] - 2025-03-01

### Added

- Gzip compression support alongside Brotli
- File filtering with glob patterns (`excludePatterns`, `includePatterns`)
- Retry logic and error callbacks for better error handling
- `skipExisting` option for skipping already-compressed files
- Maximum file size limits
- Enhanced compression statistics reporting

## [1.0.0] - 2025-02-01

### Added

- Initial release
- Brotli compression with configurable quality (0-11)
- Parallel processing with configurable concurrency
- Smart filtering by extension, size, and custom functions
- Comprehensive test suite
- Full TypeScript support with type definitions
- Vite compatibility: v4.0.0 through v7.x.x

[1.3.0]: https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/releases/tag/v1.3.0
[1.1.0]: https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/releases/tag/v1.1.0
[1.0.0]: https://github.com/riyajath-ahamed/vite-plugin-brotli-compress/releases/tag/v1.0.0
