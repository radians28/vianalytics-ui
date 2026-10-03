import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useLocalStorage } from './hooks/useLocalStorage'
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage'
import VerifyPage from './pages/VerifyPage'
import { SkuMasterView } from './components/views/SkuMasterView'
import { TeamView } from './components/views/TeamView'
import { UploadView } from './components/views/UploadView'
import { SESSION_EXPIRED_EVENT } from './utils/api-client'

function App() {
  const [authToken, setAuthToken] = useLocalStorage('access_token', {
    access_token: '',
    decoded_token: {}
  });

  // Any API call can reject with a 401 "Token has expired" — when that
  // happens, drop the stored token so we fall back to the login page.
  useEffect(() => {
    const handleSessionExpired = () => setAuthToken(undefined);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [setAuthToken]);

  // `authToken` is always an object (even the default value), so it is always
  // truthy — checking it directly never falls through to the login page.
  // What actually indicates "logged in" is a non-empty access token string.
  const isAuthenticated = Boolean(authToken?.access_token);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/upload" replace /> : <LoginPage onLogin={setAuthToken} />}
        />

        {/* Public regardless of the current session's auth state — this is a
            standalone, token-based flow for someone who may not have an
            account set up yet. */}
        <Route path="/verify" element={<VerifyPage onVerified={setAuthToken} />} />

        <Route
          element={
            isAuthenticated
              ? <MainPage authToken={authToken} onAuthChange={setAuthToken} />
              : <Navigate to="/login" replace />
          }
        >
          <Route path="/upload" element={<UploadView />} />
          <Route path="/sku" element={<SkuMasterView />} />
          <Route path="/team" element={<TeamView />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/upload' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
