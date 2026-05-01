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
import { modal } from '../../../components/Modal';
import { useDictionary } from '../../../utils/dictionary';

function ValidateData(registerData: RegisterData, t: (k: string) => string): boolean {
    if (registerData.name == "") { modal.warning(t('register.validateName')); return false; }
    if (registerData.lastname == "") { modal.warning(t('register.validateLastname')); return false; }
    if (registerData.nickname == "") { modal.warning(t('register.validateNickname')); return false; }
    if (registerData.address == "") { modal.warning(t('register.validateProvince')); return false; }
    if (registerData.username == "") { modal.warning(t('register.validateUsername')); return false; }
    if (registerData.password == "") { modal.warning(t('register.validatePassword')); return false; }
    if (registerData.phone == "") { modal.warning(t('register.validatePhone')); return false; }
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
    const { t } = useDictionary();

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

        if (!ValidateData(registerData, t)) return;

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
                    <h2 className="text-3xl font-bold text-gray-900">{t('auth.register')}</h2>
                    <p className="text-gray-500 mt-2 text-center">{t('auth.startJourney')}</p>
                </div>


                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField.Default ref={name} type='text' label={t('register.firstName')} placeholder={t('register.firstNamePlaceholder')} maxLength={50} />
                        <InputField.Default ref={lastname} type='text' label={t('register.lastName')} placeholder={t('register.lastNamePlaceholder')} maxLength={50} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField.Default ref={nickname} type='text' label={t('register.nickname')} placeholder={t('register.nickname')} maxLength={20} />
                        <InputField.Default ref={phone} type='text' label={t('register.phone')} onChange={(e) => {
                            e.target.value = e.target.value.replace(/\D/g, '')
                        }}
                            maxLength={10}
                            inputMode='numeric'
                            placeholder={t('register.phone')} />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-bold text-gray-700 ml-1">{t('province.label')}</label>
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                        >
                            <option value="">{t('province.select')}</option>
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
                                label={t('register.username')} placeholder={t('register.username')} />
                            <InputField.Default ref={password} type='password' onChange={(e) => {
                                e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                            }}
                                maxLength={16}
                                label={t('register.password')} placeholder={t('register.password')} />
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <Button.Default label={t('auth.register')} onClick={handleRegister} />
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
                    <p className="text-sm text-gray-600">
                        {t('auth.hasAccount')}{' '}
                        <span
                            onClick={() => authFunction.setAuthMode('login')}
                            className="cursor-pointer text-[var(--primary)] font-bold hover:underline"
                        >
                            {t('auth.login')}
                        </span>
                    </p>
                </div>
            </motion.div>

            <p className="mt-8 text-gray-400 text-xs">
                {t('common.copyright')}
            </p>
        </div>
    );
}