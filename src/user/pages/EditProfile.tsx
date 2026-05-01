import React, { useState, useRef } from 'react';
import { Global } from '../Global';
import { Camera, Save, ArrowLeft, User as UserIcon, MapPin, Phone, MessageSquare, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { TH_PROVINCES } from '../constants/th-provinces';
import { modal } from '../../components/Modal';
import net from '../network/client';
import { useDictionary, type Lang } from '../../utils/dictionary';
import { updateStoredField } from '../auth/function';

interface EditProfileProps {
  onBack: () => void;
}

const LANGS: { value: Lang; label: string; flag: string }[] = [
  { value: 'th', label: 'ไทย',     flag: '🇹🇭' },
  { value: 'en', label: 'EN',     flag: 'EN' },
  { value: 'cn', label: '中文',     flag: '🇨🇳' },
  { value: 'jp', label: '日本語',   flag: '🇯🇵' },
];

export default function EditProfile({ onBack }: EditProfileProps) {
  const { t, lang, setLang } = useDictionary();

  const [name, setName]           = useState(Global.user.name);
  const [bio, setBio]             = useState(Global.user.bio || '');
  const [nickname, setNickname]   = useState(Global.user.nickname || '');
  const [province, setProvince]   = useState(Global.user.province || 'กรุงเทพมหานคร');
  const [phone, setPhone]         = useState(Global.user.phone || '');
  const [profileImage, setProfileImage] = useState(Global.user.profileImage);
  const [selectedLang, setSelectedLang] = useState<Lang>(lang);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    Global.user.name     = name;
    Global.user.bio      = bio;
    Global.user.nickname = nickname;
    Global.user.province = province;
    Global.user.phone    = phone;

    // บันทึก profile ลง DB
    net.updateProfile({ name, nickname, bio, province, phone });

    // บันทึก lang ลง DB (ถ้าเปลี่ยน)
    if (selectedLang !== lang) {
      net.updateLang(selectedLang);
      setLang(selectedLang);
    }

    // update localStorage
    updateStoredField({ name, nickname, bio, province, phone, lang: selectedLang });

    modal.success(t('profile.saveSuccess'));
    onBack();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setProfileImage(localUrl);
    net.uploadProfileImage(file, Global.user.id)
      .then(url => {
        setProfileImage(url);
        Global.user.profileImage = url;
      })
      .catch(() => modal.error(t('profile.uploadError')));
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen py-6 md:py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('profile.editProfile')}</h1>
          <div className="w-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* Profile Image */}
          <div className="p-8 bg-gradient-to-br from-[#5B65F2]/5 to-[#AAB0F9]/5 border-b border-gray-50">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white overflow-hidden bg-gray-200 shadow-xl">
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 p-3 bg-[#5B65F2] hover:bg-[#4a54e1] text-white rounded-full border-4 border-white shadow-lg transition-all transform hover:scale-110 active:scale-95"
                >
                  <Camera size={20} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              </div>
              <p className="mt-4 text-sm text-gray-500 font-medium">{t('profile.clickToChange')}</p>
            </div>
          </div>

          {/* Form */}
          <div className="p-8 space-y-6">

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Globe size={16} className="text-[#5B65F2]" /> {t('nav.settings')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {LANGS.map(l => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setSelectedLang(l.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                      selectedLang === l.value
                        ? 'border-[#5B65F2] bg-[#5B65F2]/5 text-[#5B65F2]'
                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-[#5B65F2]/30'
                    }`}
                  >
                    <span className="text-2xl">{l.flag}</span>
                    <span className="text-xs font-semibold">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <UserIcon size={16} className="text-[#5B65F2]" /> {t('profile.fullName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                  placeholder={t('profile.fullName')}
                />
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#5B65F2]" /> {t('profile.nickname')}
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                  placeholder={t('profile.nickname')}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Save size={16} className="text-[#5B65F2]" /> {t('profile.bio')}
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all resize-none"
                placeholder={t('profile.bioPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Province */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <MapPin size={16} className="text-[#5B65F2]" /> {t('province.label')}
                </label>
                <select
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                >
                  {TH_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Phone size={16} className="text-[#5B65F2]" /> {t('profile.phone')}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                  placeholder="08x-xxx-xxxx"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-gray-50 flex gap-4">
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#5B65F2]/20 flex items-center justify-center gap-2"
              >
                <Save size={20} /> {t('common.save')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
