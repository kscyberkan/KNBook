import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, User, Bell, MessageCircle } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator, Text } from 'react-native';

import Feed from './src/pages/Feed';
import Profile from './src/pages/Profile';
import Login from './src/pages/Login';
import net from './src/network/client';
import { CONFIG } from './src/config';
import { PacketSC } from '../src/user/network/packetList';
import { DictionaryProvider, useDictionary } from './src/utils/dictionary';
import { GlobalProvider, useGlobal, UserData } from './src/utils/GlobalContext';

const Tab = createBottomTabNavigator();

function MainApp() {
  const { t } = useDictionary();
  const { user } = useGlobal();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Home size={size} color={color} />;
          if (route.name === 'Profile') return <User size={size} color={color} />;
          if (route.name === 'Notifications') return <Bell size={size} color={color} />;
          if (route.name === 'Messages') return <MessageCircle size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5B65F2',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
      })}
    >
      <Tab.Screen name="Home" component={Feed} options={{ title: t('nav.home') }} />
      <Tab.Screen name="Messages" component={View} options={{ title: t('nav.messages') }} />
      <Tab.Screen name="Notifications" component={View} options={{ title: t('nav.notifications') }} />
      <Tab.Screen name="Profile" component={Profile} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { ready } = useDictionary();
  const { user, setUser } = useGlobal();
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  useEffect(() => {
    // 1. เช็คสถานะ Login จาก Storage
    const checkStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const userData = await SecureStore.getItemAsync('userData');
        console.log('[AppContent] Storage loaded', { hasToken: !!token });
      } catch (e) {
        console.warn('[AppContent] Storage check failed', e);
      } finally {
        setIsStorageLoaded(true);
      }
    };
    
    // ตั้ง safety timeout 3 วินาทีสำหรับ storage
    const safetyTimer = setTimeout(() => {
      if (!isStorageLoaded) {
        console.log('[AppContent] Safety timeout: forcing storage loaded');
        setIsStorageLoaded(true);
      }
    }, 3000);

    checkStatus();

    // 2. ฟังคำสั่งจาก Server
    const unsubResume = net.on(PacketSC.RESUME_OK, () => {
      console.log('[AppContent] RESUME_OK received');
    });

    const unsubLogout = net.on(PacketSC.FORCE_LOGOUT, () => {
      console.log('[AppContent] FORCE_LOGOUT received');
      setUser(null);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubResume();
      unsubLogout();
    };
  }, []);

  // ถ้าโหลดอะไรก็ตามนานเกินไป ให้ข้ามไปหน้า Login เลย
  if (!ready || !isStorageLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#5B65F2" />
        <Text style={{ marginTop: 15, color: '#9CA3AF' }}>Loading KN Book...</Text>
      </View>
    );
  }

  const handleLoginSuccess = (token: string, userData: UserData | null) => {
    console.log('[App] handleLoginSuccess received from Login page', { name: userData?.name });
    setUser(userData);
  };

  // ตัดสินใจว่าจะไปหน้าไหน
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <MainApp />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // เริ่มต้นเชื่อมต่อ WebSocket
    const initConnection = async () => {
      let token = null;
      try {
        token = await SecureStore.getItemAsync('userToken');
      } catch (e) {
        console.warn('[App] Could not fetch token from storage', e);
      }
      // ไม่ว่าจะมี token หรือไม่ หรือจะเกิด error หรือไม่ ก็ต้องสั่ง connect เสมอ
      net.connect(CONFIG.WS_URL, token || undefined);
    };
    initConnection();
  }, []);

  return (
    <GlobalProvider>
      <DictionaryProvider>
        <AppContent />
      </DictionaryProvider>
    </GlobalProvider>
  );
}
