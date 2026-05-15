import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface UserData {
    id: string;
    name: string;
    profileImage: string;
    token: string;
    nickname: string;
    phone: string;
    province: string;
    bio: string;
    coverImage: string;
    createdAt: string;
    lang: string;
}

interface GlobalContextType {
    user: UserData | null;
    setUser: (user: UserData | null) => void;
    logout: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<UserData | null>(null);

    useEffect(() => {
        // Load user from storage on mount
        SecureStore.getItemAsync('userData').then(data => {
            if (data) {
                try {
                    setUserState(JSON.parse(data));
                } catch (e) {
                    console.error('[GlobalContext] Failed to parse stored user data', e);
                }
            }
        });
    }, []);

    const setUser = async (userData: UserData | null) => {
        console.log('[GlobalContext] setUser called', { hasUser: !!userData });
        try {
            if (userData) {
                await SecureStore.setItemAsync('userData', JSON.stringify(userData));
                await SecureStore.setItemAsync('userToken', userData.token);
                console.log('[GlobalContext] User data saved to storage');
            } else {
                await SecureStore.deleteItemAsync('userData');
                await SecureStore.deleteItemAsync('userToken');
                console.log('[GlobalContext] User data cleared from storage');
            }
        } catch (e) {
            console.error('[GlobalContext] Failed to update storage', e);
        }
        setUserState(userData);
    };

    const logout = async () => {
        await setUser(null);
    };

    return (
        <GlobalContext.Provider value={{ user, setUser, logout }}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};
