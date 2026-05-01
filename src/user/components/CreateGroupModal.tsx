import React, { useState } from 'react';
import { X, Users, Check, MessageSquarePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import net from '../network/client';
import { useDictionary } from '../../utils/dictionary';

interface Friend {
  id: string;
  name: string;
  profileImage: string | null;
}

interface CreateGroupModalProps {
  friends: Friend[];
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ friends, onClose }) => {
  const { t } = useDictionary();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim() || selected.size === 0) return;
    net.createGroup(name.trim(), Array.from(selected).map(Number));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-[#5B65F2]" />
            <span className="font-bold text-gray-900">{t('group.createGroup')}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Group name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('group.groupName')}</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder={t('group.groupNamePlaceholder')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B65F2]/20 focus:border-[#5B65F2]"
            />
          </div>

          {/* Friend list */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              {t('group.addMembers')}
              {selected.size > 0 && (
                <span className="text-[#5B65F2] ml-1">
                  ({t('group.membersCount').replace('{n}', String(selected.size))})
                </span>
              )}
            </label>
            <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
              {friends.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">{t('friend.noFriends')}</p>
              ) : friends.map(f => (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${selected.has(f.id) ? 'bg-[#5B65F2]/8' : 'hover:bg-gray-50'}`}
                >
                  <img
                    src={f.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name}`}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <span className="text-sm text-gray-800 flex-1 text-left truncate">{f.name}</span>
                  {selected.has(f.id)
                    ? <Check size={16} className="text-[#5B65F2] flex-shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  }
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0}
            className="flex-1 py-2.5 bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Users size={15} />
            {t('group.create')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
