import { useEffect, useState } from 'react'

/** Version de l’app (Electron), affichage titre / footer. */
export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    void window.electron?.app?.getVersion?.()
      .then(setVersion)
      .catch(() => { setVersion(null) })
  }, [])
  return version
}
