import React from 'react';
import { UserPlus, UserCheck, UserX, Clock } from 'lucide-react';
import { modal } from './Modal';
import net from '../network/client';

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface FriendButtonProps {
  targetId: string;
  status: FriendStatus;
  onStatusChange: (s: FriendStatus) => void;
  size?: 'sm' | 'md';
}

export const FriendButton: React.FC<FriendButtonProps> = ({ targetId, status, onStatusChange, size = 'md' }) => {
  const px = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  if (status === 'accepted') {
    return (
      <button
        onClick={() => modal.confirm('ลบเพื่อนคนนี้?', () => {
          net.removeFriend(Number(targetId));
          onStatusChange('none');
        })}
        className={`flex items-center gap-1.5 ${px} bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-600 font-medium rounded-xl border border-gray-200 hover:border-red-200 transition-all`}
      >
        <UserCheck size={14} />
        เพื่อนกัน
      </button>
    );
  }

  if (status === 'pending_sent') {
    return (
      <button
        onClick={() => modal.confirm('ยกเลิกคำขอ?', () => {
          net.removeFriend(Number(targetId));
          onStatusChange('none');
        })}
        className={`flex items-center gap-1.5 ${px} bg-gray-100 text-gray-500 font-medium rounded-xl border border-gray-200 hover:bg-red-50 hover:text-red-400 hover:border-red-200 transition-all`}
      >
        <Clock size={14} />
        รอการตอบรับ
      </button>
    );
  }

  if (status === 'pending_received') {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            net.acceptFriendRequest(Number(targetId));
            onStatusChange('accepted');
          }}
          className={`flex items-center gap-1.5 ${px} bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-medium rounded-xl transition-all`}
        >
          <UserCheck size={14} />
          ยืนยัน
        </button>
        <button
          onClick={() => {
            net.removeFriend(Number(targetId));
            onStatusChange('none');
          }}
          className={`flex items-center gap-1.5 ${px} bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl border border-gray-200 transition-all`}
        >
          <UserX size={14} />
          ปฏิเสธ
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        net.sendFriendRequest(Number(targetId));
        onStatusChange('pending_sent');
      }}
      className={`flex items-center gap-1.5 ${px} bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-medium rounded-xl shadow-sm shadow-[#5B65F2]/20 transition-all`}
    >
      <UserPlus size={14} />
      เพิ่มเพื่อน
    </button>
  );
};
