import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, Image as ImageIcon, FileText, Film, ZoomIn, Smile } from 'lucide-react';
import { type User } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { Global } from '../Global';
import { EmojiPicker } from './emoji/EmojiPicker';
import { EmojiText } from './emoji/EmojiText';
import { EmojiTextarea } from './emoji/EmojiTextarea';
import { getEmojiChar } from './emoji/emojiList';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'video' | 'file';
  timestamp: string;
  reactions?: { userId: number; emoji: string }[];
}

interface ChatWindowProps {
  friend: User;
  onClose: () => void;
  onUserClick?: (user: User) => void;
  onCall?: (callType: 'audio' | 'video') => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ friend, onClose, onUserClick, onCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msgEmojiPicker, setMsgEmojiPicker] = useState<string | null>(null); // messageId
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    net.getConversation(Number(friend.id), 0);
    net.readMessages(Number(friend.id)); // mark as read ทันทีที่เปิด

    const unsubList = net.on(PacketSC.MESSAGE_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as any[];
      const more = packet.readBool();
      const reqOffset = packet.readInt();
      const normalized = data.map(m => ({ ...m, senderId: String(m.senderId ?? m.sender?.id ?? ''), timestamp: m.timestamp ?? m.createdAt }));
      if (reqOffset === 0) {
        setMessages(normalized);
      } else {
        // prepend ข้อความเก่า — เก็บ scroll position ไว้
        setMessages(prev => [...normalized, ...prev]);
      }
      setHasMore(more);
      setOffset(reqOffset + data.length);
      setLoading(false);
      setLoadingMore(false);
    });

    const unsubNew = net.on(PacketSC.NEW_MESSAGE, (packet: Packet) => {
      const msg = JSON.parse(packet.readString()) as any;
      setMessages(prev => [...prev, { ...msg, senderId: String(msg.senderId ?? msg.sender?.id ?? ''), timestamp: msg.timestamp ?? msg.createdAt }]);
      setOffset(prev => prev + 1);
    });

    const unsubReaction = net.on(PacketSC.MESSAGE_REACTION_UPDATE, (packet: Packet) => {
      const { messageId, userId, emoji } = JSON.parse(packet.readString()) as { messageId: number; userId: number; emoji: string | null };
      setMessages(prev => prev.map(m => {
        if (m.id !== String(messageId)) return m;
        const reactions = (m.reactions ?? []).filter(r => r.userId !== userId);
        return { ...m, reactions: emoji ? [...reactions, { userId, emoji }] : reactions };
      }));
    });

    return () => { unsubList(); unsubNew(); unsubReaction(); };
  }, [friend.id]);

  const shouldScrollRef = useRef(true);
  const prevScrollHeightRef = useRef(0);

  // scroll to bottom เฉพาะตอนโหลดครั้งแรกหรือรับข้อความใหม่
  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // restore scroll position หลัง prepend ข้อความเก่า
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
    const container = messagesContainerRef.current;
    prevScrollHeightRef.current = container?.scrollHeight ?? 0;
    setLoadingMore(true);
    net.getConversation(Number(friend.id), offset);
  };

  const handleSend = (text?: string) => {
    const content = text ?? inputText.trim();
    if (!content) return;
    net.sendMessage(Number(friend.id), { text: content });
    setInputText('');
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    net.sendMessage(Number(friend.id), { file, fileType: type });
    setShowAttachMenu(false);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-visible">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] px-4 py-3 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onUserClick?.(friend)}>
          <div className="relative">
            <img src={friend.profileImage} alt={friend.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#5B65F2]" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">{friend.name}</div>
            <div className="text-[10px] text-white/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              ออนไลน์
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {/*<button onClick={() => onCall?.('audio')} className="p-2 hover:bg-white/15 rounded-full transition-colors" title="โทรด้วยเสียง"><Phone size={16} /></button>
          <button onClick={() => onCall?.('video')} className="p-2 hover:bg-white/15 rounded-full transition-colors" title="Video call"><Video size={16} /></button>*/}
          <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition-colors"><X size={17} /></button>
        </div>
      </div>

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
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs text-[#5B65F2] hover:text-[#4a54e1] font-medium px-4 py-1.5 rounded-full bg-[#5B65F2]/8 hover:bg-[#5B65F2]/15 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'กำลังโหลด...' : 'โหลดข้อความเก่า'}
                </button>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.senderId === Global.user.id;
              const msgDate = new Date(msg.timestamp);
              const prevDate = idx > 0 ? new Date(messages[idx - 1]?.timestamp ?? '') : null;
              const showDateSep = !prevDate ||
                msgDate.getFullYear() !== prevDate.getFullYear() ||
                msgDate.getMonth() !== prevDate.getMonth() ||
                msgDate.getDate() !== prevDate.getDate();
              const today = new Date();
              const isToday = msgDate.getFullYear() === today.getFullYear() && msgDate.getMonth() === today.getMonth() && msgDate.getDate() === today.getDate();
              const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
              const isYesterday = msgDate.getFullYear() === yesterday.getFullYear() && msgDate.getMonth() === yesterday.getMonth() && msgDate.getDate() === yesterday.getDate();
              const dateLabel = isToday ? 'วันนี้' : isYesterday ? 'เมื่อวาน' : msgDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <React.Fragment key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[11px] text-gray-400 font-medium px-2 flex-shrink-0">{dateLabel}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-end gap-2 relative group ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <img src={friend.profileImage} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                  )}
                  <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    {msg.text && (
                      <div className={`px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap break-words ${
                        isMe ? 'bg-[#5B65F2] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                      }`}>
                        <EmojiText text={msg.text} />
                      </div>
                    )}
                    {msg.fileType === 'image' && msg.fileUrl && (
                      <div
                        className={`rounded-2xl overflow-hidden shadow-sm cursor-pointer relative group ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        onClick={() => setLightbox({ url: msg.fileUrl!, type: 'image' })}
                      >
                        <img src={msg.fileUrl} alt="Image" className="max-w-[220px] max-h-[220px] object-cover transition-opacity group-hover:opacity-90" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <ZoomIn size={28} className="text-white drop-shadow-lg" />
                        </div>
                      </div>
                    )}
                    {msg.fileType === 'video' && msg.fileUrl && (
                      <div
                        className={`rounded-2xl overflow-hidden shadow-sm cursor-pointer relative group ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        onClick={() => setLightbox({ url: msg.fileUrl!, type: 'video' })}
                      >
                        <video src={msg.fileUrl} className="max-w-[220px] max-h-[160px] rounded-2xl pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors rounded-2xl">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                            <Film size={22} className="text-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                    {msg.fileType === 'file' && msg.fileUrl && (
                      <a
                        href={msg.fileUrl}
                        download={msg.fileName}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl shadow-sm text-sm max-w-[220px] ${
                          isMe ? 'bg-[#5B65F2] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#5B65F2]/10'}`}>
                          <FileText size={16} className={isMe ? 'text-white' : 'text-[#5B65F2]'} />
                        </div>
                        <span className="truncate font-medium text-xs">{msg.fileName}</span>
                      </a>
                    )}
                    <div className={`text-[10px] text-gray-400 px-1 ${isMe ? 'text-right' : ''}`}>
                      {(() => {
                        const d = new Date(msg.timestamp);
                        const today = new Date();
                        const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                        const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        if (isToday) return time;
                        const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                        return `${date} ${time}`;
                      })()}
                    </div>

                    {/* Reactions */}
                    {(msg.reactions?.length ?? 0) > 0 && (
                      <div className={`flex gap-0.5 flex-wrap mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(
                          (msg.reactions ?? []).reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {} as Record<string, number>)
                        ).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              const mine = msg.reactions?.find(r => r.userId === Number(Global.user.id) && r.emoji === emoji);
                              mine ? net.unreactMessage(Number(msg.id)) : net.reactMessage(Number(msg.id), emoji);
                            }}
                            className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-xs hover:bg-gray-50 transition-colors shadow-sm"
                          >
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-gray-500 text-[10px]">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Emoji react button — hover */}
                  <button
                    onClick={() => setMsgEmojiPicker(msgEmojiPicker === msg.id ? null : msg.id)}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-full text-gray-400 flex-shrink-0 self-center text-sm ${isMe ? 'order-first' : 'order-last'}`}
                  >
                    😊
                  </button>

                  {/* Mini emoji picker */}
                  {msgEmojiPicker === msg.id && (
                    <div className={`absolute ${isMe ? 'right-8' : 'left-8'} bottom-full mb-1 bg-white border border-gray-100 rounded-2xl shadow-xl px-2 py-1.5 flex gap-1 z-20`}>
                      {['❤️','😂','😮','😢','👍','🔥'].map(e => (
                        <button key={e} onClick={() => {
                          net.reactMessage(Number(msg.id), e);
                          setMsgEmojiPicker(null);
                        }} className="text-lg hover:scale-125 transition-transform p-0.5">{e}</button>
                      ))}
                    </div>
                  )}
                </motion.div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Attach Menu */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="border-t border-gray-100 bg-white px-4 py-3 flex gap-3 flex-shrink-0"
          >
            <button onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors flex-1">
              <ImageIcon size={20} className="text-green-600" />
              <span className="text-[11px] font-medium text-green-700">รูปภาพ</span>
            </button>
            <button onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors flex-1">
              <Film size={20} className="text-purple-600" />
              <span className="text-[11px] font-medium text-purple-700">วิดีโอ</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors flex-1">
              <FileText size={20} className="text-blue-600" />
              <span className="text-[11px] font-medium text-blue-700">ไฟล์</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10">
              <X size={22} />
            </button>
            {lightbox.type === 'image' ? (
              <motion.img
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                src={lightbox.url}
                alt="Preview"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="w-[90vw] max-w-3xl aspect-video"
                onClick={(e) => e.stopPropagation()}
              >
                <VideoPlayer src={lightbox.url} autoPlay onClose={() => setLightbox(null)} title=" " />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); }}
            className={`p-2 rounded-full transition-colors flex-shrink-0 mb-0.5 ${showAttachMenu ? 'bg-[#5B65F2]/10 text-[#5B65F2]' : 'text-gray-400 hover:text-[#5B65F2] hover:bg-gray-100'}`}
          >
            <Paperclip size={19} />
          </button>
          <div className="flex-1 relative flex items-end bg-gray-100 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#5B65F2]/20 rounded-2xl transition-all border border-transparent focus-within:border-gray-200">
            <EmojiTextarea
              textareaRef={textareaRef}
              value={inputText}
              onChange={setInputText}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ข้อความ..."
              className="py-2.5 px-3 pr-9 max-h-24"
            />
            <div className="absolute right-2.5 bottom-2">
              <button
                ref={emojiButtonRef}
                onClick={() => { setShowEmoji(!showEmoji); setShowAttachMenu(false); }}
                className={`transition-colors text-lg leading-none ${showEmoji ? 'opacity-100' : 'text-gray-400 hover:text-yellow-500'}`}
              >
                <Smile size={16} />
              </button>
              <EmojiPicker
                open={showEmoji}
                onSelect={(id) => {
                  const emojiChar = getEmojiChar(id) || `:${id}:`;
                  setInputText(prev => prev + emojiChar);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                onClose={() => setShowEmoji(false)}
                placement="top"
                anchorRef={emojiButtonRef as React.RefObject<HTMLElement | null>}
              />
            </div>
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className={`p-2.5 rounded-full transition-all flex-shrink-0 mb-0.5 ${
              inputText.trim() ? 'bg-[#5B65F2] text-white shadow-md shadow-[#5B65F2]/30 hover:bg-[#4a54e1] active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};
