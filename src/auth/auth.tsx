import React, { useEffect, useState } from 'react';
import auth from './function';
import Login from './login/login';
import './auth.css';
import Register from './register/register';
import { lineAuth } from './line-auth';
import net from '../network/client';
import { PacketSC } from '../network/packetList';
import { type LoginData } from '../types/login_data';
import { modal } from '../components/Modal';

type AuthProps = { children?: React.ReactNode };

type AuthFunctionType = {
    setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'register'>>;
    setLoginData: React.Dispatch<React.SetStateAction<false | LoginData>>;
};

export const authFunction: AuthFunctionType = {
    setAuthMode: () => { },
    setLoginData: () => { },
};

function Auth(props: AuthProps) {
    const [loginData, setData] = useState<LoginData | false>(auth.getLoginData());
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        authFunction.setAuthMode = setMode;
        // แยก setData กับ auth.setLoginData ออกจากกัน ไม่วนซ้ำ
        authFunction.setLoginData = setData;

        // เชื่อม WebSocket พร้อม token ถ้ามี
        const loginData = auth.getLoginData();
        net.connect(loginData ? loginData.token : undefined);

        // ถูกเตะออกจากอุปกรณ์อื่น หรือถูกแบน
        const unsubForce = net.on(PacketSC.FORCE_LOGOUT, (packet) => {
            auth.removeLoginData();
            setData(false);
            const msg = packet.readString?.() ?? '';
            modal.warning(msg || 'มีการเข้าสู่ระบบจากอุปกรณ์อื่น คุณถูกออกจากระบบแล้ว');
        });

        // resume ถูก reject (token หมดอายุ หรือถูกแบน)
        const unsubReject = net.on(PacketSC.REJECT_LOGIN, (packet) => {
            const msg = packet.readString?.() ?? '';
            if (msg.includes('ระงับ') || msg.includes('แบน')) {
                auth.removeLoginData();
                setData(false);
                modal.warning(msg);
            }
        });

        lineAuth.init().finally(() => {
            setIsInitializing(false);
        });

        return () => { unsubForce(); unsubReject(); };
    }, []);

    if (isInitializing) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-8">
                <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-lg shadow-[#5B65F2]/30 animate-bounce">
                    KN
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                    <p className="text-gray-500 mt-4 font-bold text-sm">กำลังเตรียมความพร้อม...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {loginData
                ? props.children
                : mode === 'login'
                    ? <Login />
                    : <Register />}
        </>
    );
}

export default Auth;
