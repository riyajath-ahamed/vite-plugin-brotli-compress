// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import brotliCompress, { BrotliQuality } from 'vite-plugin-brotli-compress'

export default defineConfig({
  plugins: [
    react(),
    brotliCompress({
      // File extensions to compress
      extensions: ['js', 'css', 'html', 'json'],
      
      // Compression quality (0-11)
      quality: BrotliQuality.HIGH,
      
      // Minimum file size to compress (in bytes)
      minSize: 1024,
      
      // Whether to delete original files after compression
      deleteOriginal: false,
      
      // Custom function to determine if a file should be compressed
      shouldCompress: (filePath, fileSize) => {
        // Skip vendor files
        if (filePath.includes('node_modules') || filePath.includes('vendor')) {
          return false
        }
        
        // Only compress files larger than 2KB
        return fileSize > 2048
      },
      
      // Parallel processing options
      parallel: true,
      maxParallel: 10,
      
      // Verbose logging
      verbose: true
    })
  ],
  build: {
    outDir: 'dist'
  }
})
