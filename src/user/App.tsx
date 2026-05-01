import "../index.css";
import Auth from "./auth/auth";
import PageManager from "./pages/PageManager";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CONFIG } from './auth/google-config';
import { ModalProvider } from '../components/Modal';
import { DictionaryProvider } from '../utils/dictionary';

export function App() {
  return (
    <DictionaryProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CONFIG.CLIENT_ID}>
        <ModalProvider />
        <Auth>
          <PageManager />
        </Auth>
      </GoogleOAuthProvider>
    </DictionaryProvider>
  )
}

export default App;


