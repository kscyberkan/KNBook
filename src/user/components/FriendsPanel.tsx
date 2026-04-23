import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCheck, UserX, Users, Clock, UserPlus } from 'lucide-react';
import { modal } from '../../components/Modal';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';

interface FriendUser {
  id: string;
  name: string;
  profileImage: string | null;
}

interface FriendsPanelProps {
  open: boolean;
  onClose: () => void;
  onUserClick: (user: FriendUser) => void;
}

type Tab = 'friends' | 'pending' | 'sent';

export const FriendsPanel: React.FC<FriendsPanelProps> = ({ open, onClose, onUserClick }) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pending, setPending] = useState<FriendUser[]>([]);
  const [sent, setSent] = useState<FriendUser[]>([]);

  useEffect(() => {
    if (!open) return;
    net.getFriendsPanel();
    net.getPendingRequests();
    net.getSentRequests();

    const u1 = net.on(PacketSC.FRIEND_LIST_PANEL, (p: Packet) => setFriends(JSON.parse(p.readString())));
    const u2 = net.on(PacketSC.PENDING_REQUESTS, (p: Packet) => setPending(JSON.parse(p.readString())));
    const u3 = net.on(PacketSC.SENT_REQUESTS, (p: Packet) => setSent(JSON.parse(p.readString())));
    return () => { u1(); u2(); u3(); };
  }, [open]);

  const acceptRequest = (userId: string) => {
    net.acceptFriendRequest(Number(userId));
    setPending(prev => prev.filter(u => u.id !== userId));
    // เพิ่มเข้า friends list
    const user = pending.find(u => u.id === userId);
    if (user) setFriends(prev => [...prev, user]);
  };

  const declineRequest = (userId: string) => {
    modal.confirm('ปฏิเสธคำขอเป็นเพื่อน?', () => {
      net.removeFriend(Number(userId));
      setPending(prev => prev.filter(u => u.id !== userId));
    }, 'ปฏิเสธ');
  };

  const cancelRequest = (userId: string) => {
    modal.confirm('ยกเลิกคำขอเป็นเพื่อน?', () => {
      net.removeFriend(Number(userId));
      setSent(prev => prev.filter(u => u.id !== userId));
    }, 'ยกเลิกคำขอ');
  };

  const removeFriend = (userId: string) => {
    modal.confirm('ลบเพื่อนคนนี้?', () => {
      net.removeFriend(Number(userId));
      setFriends(prev => prev.filter(u => u.id !== userId));
    }, 'ลบเพื่อน');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'friends', label: 'เพื่อน', icon: <Users size={15} />, count: friends.length },
    { id: 'pending', label: 'คำขอ', icon: <UserPlus size={15} />, count: pending.length },
    { id: 'sent', label: 'ส่งไป', icon: <Clock size={15} />, count: sent.length },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[70]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <span className="font-bold text-gray-900 text-sm">เพื่อน</span>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative ${
                    tab === t.id ? 'text-[#5B65F2]' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {(t.count ?? 0) > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === t.id ? 'bg-[#5B65F2] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{t.count}</span>
                  )}
                  {tab === t.id && (
                    <motion.div layoutId="friend-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B65F2] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {tab === 'friends' && (
                friends.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">ยังไม่มีเพื่อน</div>
                ) : friends.map(u => (
                  <FriendRow key={u.id} user={u} onUserClick={onUserClick}>
                    <button
                      onClick={() => removeFriend(u.id)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      ลบ
                    </button>
                  </FriendRow>
                ))
              )}

              {tab === 'pending' && (
                pending.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">ไม่มีคำขอที่รอ</div>
                ) : pending.map(u => (
                  <FriendRow key={u.id} user={u} onUserClick={onUserClick}>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => acceptRequest(u.id)}
                        className="flex items-center gap-1 text-xs bg-[#5B65F2] hover:bg-[#4a54e1] text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        <UserCheck size={12} /> ยืนยัน
                      </button>
                      <button
                        onClick={() => declineRequest(u.id)}
                        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        <UserX size={12} /> ปฏิเสธ
                      </button>
                    </div>
                  </FriendRow>
                ))
              )}

              {tab === 'sent' && (
                sent.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">ไม่มีคำขอที่ส่งออกไป</div>
                ) : sent.map(u => (
                  <FriendRow key={u.id} user={u} onUserClick={onUserClick}>
                    <button
                      onClick={() => cancelRequest(u.id)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      ยกเลิก
                    </button>
                  </FriendRow>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const FriendRow: React.FC<{ user: FriendUser; onUserClick: (u: FriendUser) => void; children: React.ReactNode }> = ({ user, onUserClick, children }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
    <img
      src={user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
      alt={user.name}
      className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"
      onClick={() => onUserClick(user)}
    />
    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onUserClick(user)}>
      <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
    </div>
    {children}
  </div>
);
