import "../index.css";
import Auth from "./auth/auth";
import PageManager from "./pages/PageManager";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CONFIG } from './auth/google-config';
import { ModalProvider } from '../components/Modal';

export function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CONFIG.CLIENT_ID}>
      <ModalProvider />
      <Auth>
        <PageManager />
      </Auth>
    </GoogleOAuthProvider>
  )
}

export default App;


