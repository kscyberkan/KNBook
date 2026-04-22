import './register.css';
import InputField from '../../components/inputfield';
import Button from '../../components/button';
import register from './function';
import { useRef, useState } from 'react';

interface RegisterData {
    name: string;
    lastname: string;
    nickname: string;
    address: string;
    username: string;
    password: string;
    phone: string;
}

import { authFunction } from '../auth';
import { motion } from 'framer-motion';
import { useTheme } from "../../../utils/theme";
import { TH_PROVINCES } from '../../constants/th-provinces';
import { modal } from '../../components/Modal';

function ValidateData(registerData: RegisterData): boolean {
    if (registerData.name == "") { modal.warning("กรุณากรอกชื่อ"); return false; }
    if (registerData.lastname == "") { modal.warning("กรุณากรอกนามสกุล"); return false; }
    if (registerData.nickname == "") { modal.warning("กรุณากรอกชื่อเล่น"); return false; }
    if (registerData.address == "") { modal.warning("กรุณาเลือกจังหวัด"); return false; }
    if (registerData.username == "") { modal.warning("กรุณากรอกชื่อผู้ใช้"); return false; }
    if (registerData.password == "") { modal.warning("กรุณากรอกรหัสผ่าน"); return false; }
    if (registerData.phone == "") { modal.warning("กรุณากรอกเบอร์โทรศัพท์"); return false; }
    return true;
}

export default function Register() {
    const name = useRef<HTMLInputElement>(null);
    const lastname = useRef<HTMLInputElement>(null);
    const nickname = useRef<HTMLInputElement>(null);
    const [selectedProvince, setSelectedProvince] = useState('');
    const username = useRef<HTMLInputElement>(null);
    const password = useRef<HTMLInputElement>(null);
    const phone = useRef<HTMLInputElement>(null);

    function handleRegister(e: React.FormEvent) {
        e.preventDefault();

        const registerData: RegisterData = {
            name: name.current?.value || "",
            lastname: lastname.current?.value || "",
            nickname: nickname.current?.value || "",
            address: selectedProvince,
            username: username.current?.value || "",
            password: password.current?.value || "",
            phone: phone.current?.value || ""
        };

        if (!ValidateData(registerData)) return;

        register.Register(registerData);
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4 py-8">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-[500px] rounded-2xl bg-[var(--card)] p-8 shadow-2xl border border-[var(--border)]"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-[#5B65F2]/30">
                        KN
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">สมัครสมาชิก</h2>
                    <p className="text-gray-500 mt-2 text-center">เริ่มต้นการเดินทางใน KN Book ของคุณ</p>
                </div>


                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField.Default ref={name} type='text' label='ชื่อ' placeholder='ชื่อจริง' maxLength={50} />
                        <InputField.Default ref={lastname} type='text' label='นามสกุล' placeholder='นามสกุล' maxLength={50} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField.Default ref={nickname} type='text' label='ชื่อเล่น' placeholder='ชื่อเล่น' maxLength={20} />
                        <InputField.Default ref={phone} type='text' label='เบอร์โทรศัพท์' onChange={(e) => {
                            e.target.value = e.target.value.replace(/\D/g, '')
                        }}
                            maxLength={10}
                            inputMode='numeric'
                            placeholder='เบอร์โทรศัพท์' />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-bold text-gray-700 ml-1">จังหวัด</label>
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                        >
                            <option value="">เลือกจังหวัด</option>
                            {TH_PROVINCES.map(province => (
                                <option key={province} value={province}>{province}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-2 border-t border-gray-100 mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                            <InputField.Default ref={username} type='text' onChange={(e) => {
                                e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                            }}
                                maxLength={16}
                                label='ชื่อผู้ใช้' placeholder='ชื่อผู้ใช้' />
                            <InputField.Default ref={password} type='password' onChange={(e) => {
                                e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                            }}
                                maxLength={16}
                                label='รหัสผ่าน' placeholder='รหัสผ่าน' />
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <Button.Default label="สมัครสมาชิก" onClick={handleRegister} />
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
                    <p className="text-sm text-gray-600">
                        มีบัญชีอยู่แล้ว?{' '}
                        <span
                            onClick={() => authFunction.setAuthMode('login')}
                            className="cursor-pointer text-[var(--primary)] font-bold hover:underline"
                        >
                            เข้าสู่ระบบ
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