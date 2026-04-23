import React, { useState, useRef } from 'react';
import { Global } from '../Global';
import { Camera, Save, ArrowLeft, User as UserIcon, MapPin, Phone, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { TH_PROVINCES } from '../constants/th-provinces';
import { modal } from '../../components/Modal';
import net from '../network/client';

interface EditProfileProps {
  onBack: () => void;
}

export default function EditProfile({ onBack }: EditProfileProps) {
  const [name, setName] = useState(Global.user.name);
  const [bio, setBio] = useState(Global.user.bio || "");
  const [nickname, setNickname] = useState(Global.user.nickname || "");
  const [province, setProvince] = useState(Global.user.province || "กรุงเทพมหานคร");
  const [phone, setPhone] = useState(Global.user.phone || "");
  const [profileImage, setProfileImage] = useState(Global.user.profileImage);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    Global.user.name     = name;
    Global.user.bio      = bio;
    Global.user.nickname = nickname;
    Global.user.province = province;
    Global.user.phone    = phone;

    // บันทึกลง DB
    net.updateProfile({ name, nickname, bio, province, phone });

    // update localStorage
    const stored = localStorage.getItem('loginData');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        localStorage.setItem('loginData', JSON.stringify({ ...data, name, nickname, bio, province, phone }));
      } catch { /* ignore */ }
    }

    modal.success('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    onBack();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // preview ทันที
    const localUrl = URL.createObjectURL(file);
    setProfileImage(localUrl);
    net.uploadProfileImage(file, Global.user.id)
      .then(url => {
        setProfileImage(url);
        Global.user.profileImage = url;
      })
      .catch(() => modal.error('อัปโหลดรูปไม่สำเร็จ'));
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
          <h1 className="text-2xl font-bold text-gray-900">แก้ไขโปรไฟล์</h1>
          <div className="w-10"></div> {/* Spacer */}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* Profile Image Section */}
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
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <p className="mt-4 text-sm text-gray-500 font-medium">คลิกไอคอนกล้องเพื่อเปลี่ยนรูปโปรไฟล์</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <UserIcon size={16} className="text-[#5B65F2]" /> ชื่อ-นามสกุล
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#5B65F2]" /> ชื่อเล่น
                </label>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all"
                  placeholder="กรอกชื่อเล่น"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Save size={16} className="text-[#5B65F2]" /> แนะนำตัวเอง
              </label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-4 focus:ring-[#5B65F2]/10 focus:border-[#5B65F2] transition-all resize-none"
                placeholder="บอกเล่าเรื่องราวของคุณ..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Province */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <MapPin size={16} className="text-[#5B65F2]" /> จังหวัด
                </label>
                <select 
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
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
                  <Phone size={16} className="text-[#5B65F2]" /> เบอร์โทรศัพท์
                </label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                ยกเลิก
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-3 bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#5B65F2]/20 flex items-center justify-center gap-2"
              >
                <Save size={20} /> บันทึกข้อมูล
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
