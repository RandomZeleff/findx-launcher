import { useState, useCallback } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ProfileProvider, useProfile } from './context/ProfileContext'
import { AppProvider } from './context/AppContext'
import { Shell } from './components/layout/Shell'
import { SplashScreen } from './components/SplashScreen'
import { ProfileSetup } from './pages/ProfileSetup'
import { OnboardingModal } from './components/OnboardingModal'
import { Library } from './pages/Library'
import { Store } from './pages/Store'
import { News } from './pages/News'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'

function Inner() {
  const { profile } = useProfile()
  const [splashDone, setSplashDone] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('findx_onboarding_done')
  )
  const handleSplashDone = useCallback(() => setSplashDone(true), [])

  if (!splashDone) {
    return <SplashScreen onDone={handleSplashDone} />
  }

  if (!profile) {
    return <ProfileSetup />
  }

  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Library />} />
            <Route path="store" element={<Store />} />
            <Route path="news" element={<News />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
      {!onboardingDone && <OnboardingModal onDone={() => setOnboardingDone(true)} />}
    </AppProvider>
  )
}

export default function App() {
  return (
    <ProfileProvider>
      <Inner />
    </ProfileProvider>
  )
}
