import './login.css';
import InputField from '../../components/inputfield';
import login from './function';
import { authFunction } from '../auth';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../utils/theme';
import Button from '../../components/button';
import { lineAuth } from '../line-auth';
import { useGoogleLogin } from '@react-oauth/google';
import { googleAuth } from '../google-auth';

export default function Login() {
    const username = useRef<HTMLInputElement>(null);
    const password = useRef<HTMLInputElement>(null);
    const [isLineLoading, setIsLineLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const googleLogin = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            googleAuth.handleLoginSuccess(tokenResponse);
            setIsGoogleLoading(false);
        },
        onError: (error) => {
            console.log('Login Failed:', error);
            setIsGoogleLoading(false);
        },
        onNonOAuthError: () => {
            setIsGoogleLoading(false);
        }
    });


    function handleLogin(e: React.FormEvent) {
        e.preventDefault();

        const user = username.current?.value || "";
        const pass = password.current?.value || "";

        login.Login(user, pass);
    }

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[var(--bg)]"
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-[400px] rounded-2xl bg-[var(--card)] p-8 shadow-2xl border border-[var(--border)]"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-[#5B65F2]/30">
                        KN
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">
                        เข้าสู่ระบบ
                    </h2>
                    <p className="text-gray-500 mt-2 text-center">
                        ยินดีต้อนรับกลับเข้าสู่ KN Book
                    </p>
                </div>


                <div className="space-y-5">
                    <InputField.Default ref={username} type='text' onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                    }}
                        maxLength={16}
                        label='Username' placeholder='ชื่อผู้ใช้' />
                    <InputField.Default ref={password} type='password' onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                    }}
                        maxLength={16}
                        label='Password' placeholder='รหัสผ่าน' />
                </div>

                <div className="mt-8">
                    <Button.Default label="เข้าสู่ระบบ" onClick={handleLogin} />
                </div>

                <div className="mt-6 flex items-center space-x-3">
                    <div className="flex-1 h-[1px] bg-gray-100"></div>
                    <span className="text-xs text-gray-400 font-medium">หรือเข้าสู่ระบบด้วย</span>
                    <div className="flex-1 h-[1px] bg-gray-100"></div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                        onClick={async () => {
                            setIsLineLoading(true);
                            try {
                                await lineAuth.login();
                            } finally {
                                setIsLineLoading(false);
                            }
                        }}
                        disabled={isLineLoading}
                        className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-[#06C755] hover:bg-[#05b34c] disabled:bg-[#06C755]/70 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 group"
                    >
                        {isLineLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.052.303-.251 1.184 1.081.644 1.333-.541 7.199-4.24 9.823-7.262 1.861-1.99 3.135-4.043 3.135-5.704z" />
                                <text x="12" y="13"
                                    text-anchor="middle"
                                    font-size="6.5"
                                    font-weight="bold"
                                    font-family="Arial, Helvetica, sans-serif"
                                    fill="#05b34c">
                                    LINE
                                </text>
                            </svg>
                        )}
                        <span className="text-sm font-bold">{isLineLoading ? 'กำลังโหลด...' : 'LINE'}</span>
                    </button>
                    <button
                        onClick={() => {
                            setIsGoogleLoading(true);
                            googleLogin();
                        }}
                        disabled={isGoogleLoading}
                        className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 rounded-xl transition-all border border-gray-200 shadow-sm hover:shadow-md active:scale-95 group"
                    >
                        {isGoogleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        <span className="text-sm font-bold">{isGoogleLoading ? 'กำลังโหลด...' : 'Google'}</span>
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
                    <p className="text-sm text-gray-600">
                        ยังไม่มีบัญชีผู้ใช้?{' '}
                        <span
                            onClick={() => authFunction.setAuthMode('register')}
                            className="cursor-pointer text-[var(--primary)] font-bold hover:underline"
                        >
                            สร้างบัญชีใหม่
                        </span>
                    </p>
                </div>
            </motion.div>

            <p className="mt-8 text-gray-400 text-xs">
                © 2026 KN Book. All rights reserved.
            </p>
        </div>
    );
}