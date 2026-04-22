import liff from '@line/liff';
import { LINE_CONFIG } from './line-config';
import auth from './function';

class LineAuth {
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    
    try {
      await liff.init({ liffId: LINE_CONFIG.LIFF_ID });
      this.isInitialized = true;
      
      if (liff.isLoggedIn()) {
        await this.handleLoggedIn();
      }
    } catch (error) {
      console.error('LIFF Initialization failed', error);
    }
  }

  async login() {
    if (!this.isInitialized) {
      await this.init();
    }
    
    if (!liff.isLoggedIn()) {
      liff.login();
    } else {
      await this.handleLoggedIn();
    }
  }

  async handleLoggedIn() {
    try {
      const profile = await liff.getProfile();
      const idToken = liff.getIDToken();
      
      // แปลงข้อมูลจาก LINE เป็น LoginData ของแอป
      auth.setLoginData({
        id: profile.userId,
        username: profile.displayName,
        token: idToken || 'line-auth-token'
      });
      
    } catch (error) {
      console.error('Failed to get LINE profile', error);
    }
  }

  logout() {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
    auth.removeLoginData();
  }
}

export const lineAuth = new LineAuth();
