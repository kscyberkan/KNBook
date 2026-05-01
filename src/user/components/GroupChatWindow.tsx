import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, Image as ImageIcon, FileText, Film, ZoomIn, Smile, Users, Settings, UserPlus, LogOut, Trash2, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { Global } from '../Global';
import { EmojiPicker } from './emoji/EmojiPicker';
import { EmojiText } from './emoji/EmojiText';
import { EmojiTextarea } from './emoji/EmojiTextarea';
import { getEmojiChar } from './emoji/emojiList';
import { modal } from '../../components/Modal';
import { useDictionary } from '../../utils/dictionary';

export interface GroupMember {
  userId: string;
  role: string;
  user: { id: string; name: string; profileImage: string | null };
}

export interface GroupChat {
  id: string;
  name: string;
  imageUrl?: string | null;
  createdById: number;
  members: GroupMember[];
}

interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'video' | 'file';
  isSystem?: boolean;
  createdAt: string;
  sender: { id: string; name: string; profileImage: string | null };
  reactions?: { userId: number; emoji: string }[];
}

interface GroupChatWindowProps {
  group: GroupChat;
  onClose: () => void;
  onUserClick?: (userId: string, name: string, profileImage: string) => void;
  onGroupUpdate?: (group: GroupChat) => void;
  onGroupDeleted?: (groupId: string) => void;
}

export const GroupChatWindow: React.FC<GroupChatWindowProps> = ({
  group: initialGroup,
  onClose,
  onUserClick,
  onGroupUpdate,
  onGroupDeleted,
}) => {
  const { t } = useDictionary();
  const [group, setGroup] = useState<GroupChat>(initialGroup);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const shouldScrollRef = useRef(true);
  const prevScrollHeightRef = useRef(0);

  const isAdmin = group.members.find(m => m.userId === Global.user.id)?.role === 'admin';
  const isOwner = group.createdById === Number(Global.user.id);

  useEffect(() => {
    net.getGroupMessages(Number(group.id), 0);

    const unsubList = net.on(PacketSC.GROUP_MESSAGE_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as GroupMessage[];
      const more = packet.readBool();
      const reqOffset = packet.readInt();
      const gId = String(packet.readInt());
      if (gId !== group.id) return;

      if (reqOffset === 0) {
        setMessages(data);
        setLoading(false);
      } else {
        setMessages(prev => [...data, ...prev]);
        setLoadingMore(false);
      }
      setHasMore(more);
      setOffset(reqOffset + data.length);
    });

    const unsubNew = net.on(PacketSC.NEW_GROUP_MESSAGE, (packet: Packet) => {
      const msg = JSON.parse(packet.readString()) as GroupMessage;
      if (msg.groupId !== group.id) return;
      setMessages(prev => [...prev, msg]);
      setOffset(prev => prev + 1);
    });

    const unsubMember = net.on(PacketSC.GROUP_MEMBER_UPDATE, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as { groupId: string; members: GroupMember[]; removedUserId?: string };
      if (data.groupId !== group.id) return;
      if (data.removedUserId === Global.user.id) { onClose(); return; }
      const updated = { ...group, members: data.members };
      setGroup(updated);
      onGroupUpdate?.(updated);
    });

    const unsubUpdated = net.on(PacketSC.GROUP_UPDATED, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as { groupId: string; name: string };
      if (data.groupId !== group.id) return;
      const updated = { ...group, name: data.name };
      setGroup(updated);
      setNewName(data.name);
      onGroupUpdate?.(updated);
    });

    const unsubDeleted = net.on(PacketSC.GROUP_DELETED, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as { groupId: string };
      if (data.groupId !== group.id) return;
      onGroupDeleted?.(group.id);
      onClose();
    });

    const unsubReaction = net.on(PacketSC.GROUP_REACTION_UPDATE, (packet: Packet) => {
      const { messageId, userId, emoji, groupId: gId } = JSON.parse(packet.readString()) as { messageId: string; userId: number; emoji: string | null; groupId: string };
      if (gId !== group.id) return;
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = (m.reactions ?? []).filter(r => r.userId !== userId);
        return { ...m, reactions: emoji ? [...reactions, { userId, emoji }] : reactions };
      }));
    });

    return () => { unsubList(); unsubNew(); unsubMember(); unsubUpdated(); unsubDeleted(); unsubReaction(); };
  }, [group.id]);

  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!loadingMore) {
      const container = messagesContainerRef.current;
      if (container && prevScrollHeightRef.current > 0) {
        container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
        prevScrollHeightRef.current = 0;
        shouldScrollRef.current = true;
      }
    }
  }, [loadingMore]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    shouldScrollRef.current = false;
    prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? 0;
    setLoadingMore(true);
    net.getGroupMessages(Number(group.id), offset);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    net.sendGroupMessage(Number(group.id), { text: inputText.trim() });
    setInputText('');
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    net.sendGroupMessage(Number(group.id), { file, fileType: type });
    setShowAttachMenu(false);
    e.target.value = '';
  };

  const handleSaveName = () => {
    if (!newName.trim() || newName === group.name) { setEditingName(false); return; }
    net.updateGroupName(Number(group.id), newName.trim());
    setEditingName(false);
  };

  // Group avatar — stack first 3 member avatars
  const avatarMembers = group.members.slice(0, 3);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] px-4 py-3 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Group avatar */}
          <div className="relative w-9 h-9 flex-shrink-0">
            {avatarMembers.map((m, i) => (
              <img
                key={m.userId}
                src={m.user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user.name}`}
                className="absolute w-5 h-5 rounded-full border border-white object-cover"
                style={{ top: i === 0 ? 0 : i === 1 ? 4 : 8, left: i === 0 ? 0 : i === 1 ? 8 : 16 }}
              />
            ))}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">{group.name}</div>
            <div className="text-[10px] text-white/70">{group.members.length} สมาชิก</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => { setShowMembers(!showMembers); setShowSettings(false); }} className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <Users size={16} />
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setShowMembers(false); }} className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <Settings size={16} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Members Panel */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-100 bg-gray-50 overflow-hidden flex-shrink-0"
          >
            <div className="p-3 max-h-48 overflow-y-auto space-y-1">
              <div className="text-xs font-semibold text-gray-500 mb-2">สมาชิก ({group.members.length})</div>
              {group.members.map(m => (
                <div key={m.userId} className="flex items-center gap-2 py-1">
                  <img
                    src={m.user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user.name}`}
                    className="w-7 h-7 rounded-full object-cover cursor-pointer"
                    onClick={() => onUserClick?.(m.user.id, m.user.name, m.user.profileImage ?? '')}
                  />
                  <span className="text-sm text-gray-800 flex-1 truncate">{m.user.name}</span>
                  {m.role === 'admin' && <span className="text-[10px] bg-[#5B65F2]/10 text-[#5B65F2] px-1.5 py-0.5 rounded-full font-medium">Admin</span>}
                  {isAdmin && m.userId !== Global.user.id && (
                    <button
                      onClick={() => modal.confirm(`นำ ${m.user.name} ออกจากกลุ่ม?`, () => net.removeGroupMember(Number(group.id), Number(m.userId)), 'นำออก')}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-100 bg-gray-50 overflow-hidden flex-shrink-0"
          >
            <div className="p-3 space-y-2">
              {/* Rename */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <>
                      <input
                        autoFocus
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        className="flex-1 text-sm border border-[#5B65F2] rounded-lg px-2 py-1 focus:outline-none"
                      />
                      <button onClick={handleSaveName} className="p-1 text-[#5B65F2]"><Check size={16} /></button>
                      <button onClick={() => setEditingName(false)} className="p-1 text-gray-400"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={() => setEditingName(true)} className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#5B65F2] transition-colors">
                      <Edit2 size={14} /> เปลี่ยนชื่อกลุ่ม
                    </button>
                  )}
                </div>
              )}
              {/* Leave */}
              <button
                onClick={() => modal.confirm('ออกจากกลุ่มนี้?', () => net.leaveGroup(Number(group.id)), 'ออกจากกลุ่ม')}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={14} /> ออกจากกลุ่ม
              </button>
              {/* Delete (owner only) */}
              {isOwner && (
                <button
                  onClick={() => modal.confirm('ลบกลุ่มนี้? ข้อความทั้งหมดจะหายไป', () => net.deleteGroup(Number(group.id)), 'ลบกลุ่ม')}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={14} /> ลบกลุ่ม
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50/60">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-1">
                <button onClick={loadMore} disabled={loadingMore} className="text-xs text-[#5B65F2] font-medium px-4 py-1.5 rounded-full bg-[#5B65F2]/8 hover:bg-[#5B65F2]/15 transition-colors disabled:opacity-50">
                  {loadingMore ? t('common.loading') : t('chat.loadOlderMessages')}
                </button>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === Global.user.id;
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  {/* System message */}
                  {msg.isSystem ? (
                    <div className="flex justify-center">
                      <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.text}</span>
                    </div>
                  ) : (
                    <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <img
                          src={msg.sender.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender.name}`}
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5 cursor-pointer"
                          onClick={() => onUserClick?.(msg.sender.id, msg.sender.name, msg.sender.profileImage ?? '')}
                        />
                      )}
                      <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && <span className="text-[10px] text-gray-500 font-medium px-1">{msg.sender.name}</span>}
                        {msg.text && (
                          <div className={`px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap break-words ${isMe ? 'bg-[#5B65F2] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                            <EmojiText text={msg.text} />
                          </div>
                        )}
                        {msg.fileType === 'image' && msg.fileUrl && (
                          <div className={`rounded-2xl overflow-hidden shadow-sm cursor-pointer relative group ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} onClick={() => setLightbox({ url: msg.fileUrl!, type: 'image' })}>
                            <img src={msg.fileUrl} className="max-w-[220px] max-h-[220px] object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <ZoomIn size={28} className="text-white drop-shadow-lg" />
                            </div>
                          </div>
                        )}
                        {msg.fileType === 'video' && msg.fileUrl && (
                          <div className={`rounded-2xl overflow-hidden shadow-sm cursor-pointer relative group ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} onClick={() => setLightbox({ url: msg.fileUrl!, type: 'video' })}>
                            <video src={msg.fileUrl} className="max-w-[220px] max-h-[160px] rounded-2xl pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
                              <Film size={22} className="text-white" />
                            </div>
                          </div>
                        )}
                        {msg.fileType === 'file' && msg.fileUrl && (
                          <a href={msg.fileUrl} download={msg.fileName} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl shadow-sm text-sm max-w-[220px] ${isMe ? 'bg-[#5B65F2] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                            <FileText size={16} className={isMe ? 'text-white' : 'text-[#5B65F2]'} />
                            <span className="truncate font-medium text-xs">{msg.fileName}</span>
                          </a>
                        )}
                        <div className={`text-[10px] text-gray-400 px-1 ${isMe ? 'text-right' : ''}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {/* Reactions */}
                        {(msg.reactions?.length ?? 0) > 0 && (
                          <div className={`flex gap-0.5 flex-wrap mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries((msg.reactions ?? []).reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {} as Record<string, number>)).map(([emoji, count]) => (
                              <button key={emoji} onClick={() => {
                                const mine = msg.reactions?.find(r => r.userId === Number(Global.user.id) && r.emoji === emoji);
                                mine ? net.unreactGroupMessage(Number(msg.id), Number(group.id)) : net.reactGroupMessage(Number(msg.id), emoji, Number(group.id));
                              }} className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-xs hover:bg-gray-50 shadow-sm">
                                <span>{emoji}</span>
                                {count > 1 && <span className="text-gray-500 text-[10px]">{count}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Attach Menu */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }} className="border-t border-gray-100 bg-white px-4 py-3 flex gap-3 flex-shrink-0">
            <button onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors flex-1">
              <ImageIcon size={20} className="text-green-600" />
              <span className="text-[11px] font-medium text-green-700">{t('chat.image')}</span>
            </button>
            <button onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors flex-1">
              <Film size={20} className="text-purple-600" />
              <span className="text-[11px] font-medium text-purple-700">{t('chat.video')}</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors flex-1">
              <FileText size={20} className="text-blue-600" />
              <span className="text-[11px] font-medium text-blue-700">{t('chat.file')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileSelect(e, 'video')} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFileSelect(e, 'file')} />

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"><X size={22} /></button>
            {lightbox.type === 'image' ? (
              <motion.img initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} src={lightbox.url} className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
            ) : (
              <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} className="w-[90vw] max-w-3xl aspect-video" onClick={e => e.stopPropagation()}>
                <VideoPlayer src={lightbox.url} autoPlay onClose={() => setLightbox(null)} title=" " />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); }} className={`p-2 rounded-full transition-colors flex-shrink-0 mb-0.5 ${showAttachMenu ? 'bg-[#5B65F2]/10 text-[#5B65F2]' : 'text-gray-400 hover:text-[#5B65F2] hover:bg-gray-100'}`}>
            <Paperclip size={19} />
          </button>
          <div className="flex-1 relative flex items-end bg-gray-100 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#5B65F2]/20 rounded-2xl transition-all border border-transparent focus-within:border-gray-200">
            <EmojiTextarea textareaRef={textareaRef} value={inputText} onChange={setInputText} onKeyDown={handleKeyDown} placeholder={t('chat.typeMessage')} className="py-2.5 px-3 pr-9 max-h-24" />
            <div className="absolute right-2.5 bottom-2">
              <button ref={emojiButtonRef} onClick={() => { setShowEmoji(!showEmoji); setShowAttachMenu(false); }} className={`transition-colors text-lg leading-none ${showEmoji ? 'opacity-100' : 'text-gray-400 hover:text-yellow-500'}`}>
                <Smile size={16} />
              </button>
              <EmojiPicker open={showEmoji} onSelect={id => { setInputText(prev => prev + (getEmojiChar(id) || `:${id}:`)); setTimeout(() => textareaRef.current?.focus(), 0); }} onClose={() => setShowEmoji(false)} placement="top" anchorRef={emojiButtonRef as React.RefObject<HTMLElement | null>} />
            </div>
          </div>
          <button onClick={handleSend} disabled={!inputText.trim()} className={`p-2.5 rounded-full transition-all flex-shrink-0 mb-0.5 ${inputText.trim() ? 'bg-[#5B65F2] text-white shadow-md shadow-[#5B65F2]/30 hover:bg-[#4a54e1] active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};
