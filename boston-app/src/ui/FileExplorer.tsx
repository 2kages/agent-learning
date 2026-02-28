import { useState } from 'react'
import type { VirtualFS } from '../fs/virtual-fs'

interface FileExplorerProps {
  fs: VirtualFS
  files: string[]
}

/**
 * Displays virtual file system contents.
 * Click a file to view its content.
 */
export function FileExplorer({ fs, files }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const content = selectedFile ? fs.readFile(selectedFile) : null

  return (
    <div data-testid="file-panel" style={{ flex: 1, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>
        Files ({files.length})
      </h3>
      {files.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No files yet</p>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: 8, overflow: 'hidden' }}>
          <div style={{ minWidth: 160, overflow: 'auto', borderRight: '1px solid #e5e7eb', paddingRight: 8 }}>
            {files.map(path => (
              <div
                key={path}
                data-testid="file-entry"
                onClick={() => setSelectedFile(path)}
                style={{
                  padding: '4px 8px',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  backgroundColor: selectedFile === path ? '#eff6ff' : 'transparent',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {path}
              </div>
            ))}
          </div>
          {content !== null && (
            <pre
              data-testid="file-content"
              style={{
                flex: 1,
                margin: 0,
                padding: 8,
                fontSize: 12,
                fontFamily: 'monospace',
                backgroundColor: '#f9fafb',
                borderRadius: 4,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
