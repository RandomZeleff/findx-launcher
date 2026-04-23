import React, { createContext, useContext, useState } from 'react'

export interface Profile {
  username: string
  avatarColor: string
  createdAt: number
}

interface ProfileContextValue {
  profile: Profile | null
  setupProfile: (username: string, avatarColor: string) => void
  updateProfile: (updates: Partial<Pick<Profile, 'username' | 'avatarColor'>>) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

const STORAGE_KEY = 'findx_profile'

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as Profile } catch { return null }
  })

  function setupProfile(username: string, avatarColor: string) {
    const p: Profile = { username, avatarColor, createdAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setProfile(p)
  }

  function updateProfile(updates: Partial<Pick<Profile, 'username' | 'avatarColor'>>) {
    if (!profile) return
    const updated = { ...profile, ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setProfile(updated)
  }

  return (
    <ProfileContext.Provider value={{ profile, setupProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
