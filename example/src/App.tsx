import React from 'react'

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Vite Plugin Brotli Compress Example</h1>
      <p>This is a simple React app that demonstrates the Brotli compression plugin.</p>
      <p>After building, check the dist folder for .br compressed files!</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Features:</h2>
        <ul>
          <li>✅ Automatic Brotli compression</li>
          <li>✅ Configurable compression quality</li>
          <li>✅ File filtering options</li>
          <li>✅ Parallel processing</li>
          <li>✅ Detailed compression statistics</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Build Commands:</h2>
        <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
{`npm run build
# Check dist/ folder for .br files`}
        </pre>
      </div>
    </div>
  )
}

export default App
