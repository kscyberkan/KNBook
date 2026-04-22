import { googleLogout } from '@react-oauth/google';
import auth from './function';

class GoogleAuth {
  async handleLoginSuccess(tokenResponse: any) {
    try {
      // ดึงข้อมูลโปรไฟล์จาก Google API โดยใช้ access token
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });
      
      const profile = await res.json();
      
      // แปลงข้อมูลจาก Google เป็น LoginData ของแอป
      auth.setLoginData({
        id: profile.sub,
        username: profile.name,
        token: tokenResponse.access_token
      });
      
    } catch (error) {
      console.error('Failed to get Google profile', error);
    }
  }

  logout() {
    googleLogout();
    auth.removeLoginData();
  }
}

export const googleAuth = new GoogleAuth();
