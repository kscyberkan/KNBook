import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, Phone, Video, Image as ImageIcon, FileText, Film, ZoomIn } from 'lucide-react';
import { type User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './VideoPlayer';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { Global } from '../Global';
import { EmojiPicker } from './emoji/EmojiPicker';
import { EmojiText } from './emoji/EmojiText';
import { EmojiTextarea } from './emoji/EmojiTextarea';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'video' | 'file';
  timestamp: string;
}

interface ChatWindowProps {
  friend: User;
  onClose: () => void;
  onUserClick?: (user: User) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ friend, onClose, onUserClick }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    net.getConversation(Number(friend.id));

    const unsubList = net.on(PacketSC.MESSAGE_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as any[];
      // normalize senderId เป็น string เพื่อเปรียบเทียบกับ Global.user.id
      setMessages(data.map(m => ({ ...m, senderId: String(m.senderId ?? m.sender?.id ?? '') })));
      setLoading(false);
    });

    const unsubNew = net.on(PacketSC.NEW_MESSAGE, (packet: Packet) => {
      const msg = JSON.parse(packet.readString()) as any;
      setMessages(prev => [...prev, { ...msg, senderId: String(msg.senderId ?? msg.sender?.id ?? '') }]);
    });

    return () => { unsubList(); unsubNew(); };
  }, [friend.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="flex flex-col h-full bg-white overflow-hidden">
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
          <button className="p-2 hover:bg-white/15 rounded-full transition-colors"><Phone size={16} /></button>
          <button className="p-2 hover:bg-white/15 rounded-full transition-colors"><Video size={16} /></button>
          <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition-colors"><X size={17} /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50/60">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMe = msg.senderId === Global.user.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
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
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
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
                onClick={() => { setShowEmoji(!showEmoji); setShowAttachMenu(false); }}
                className={`transition-colors text-lg leading-none ${showEmoji ? 'opacity-100' : 'text-gray-400 hover:text-yellow-500'}`}
              >
                😊
              </button>
              <EmojiPicker
                open={showEmoji}
                onSelect={(id) => {
                  setInputText(prev => prev + `:${id}:`);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                onClose={() => setShowEmoji(false)}
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
