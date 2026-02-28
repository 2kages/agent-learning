import { useState, useEffect, useMemo } from 'react'
import { VirtualFS } from '../fs/virtual-fs'

/**
 * React hook providing a VirtualFS instance and reactive file list.
 * Re-renders when files are added/removed.
 */
export function useVirtualFS() {
  const fs = useMemo(() => new VirtualFS(), [])
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    const update = () => setFiles(fs.listFiles())
    update()
    return fs.onChange(update)
  }, [fs])

  return { fs, files }
}
