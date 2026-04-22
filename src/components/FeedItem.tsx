import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, MessageCircle, Share2, Image as ImageIcon, StickyNote, Send, Heart, Laugh, Annoyed, Frown, Angry, MoreHorizontal, X, Reply } from 'lucide-react';
import { Global } from '../Global';
import { VideoPlayer } from './VideoPlayer';
import { type User, type Post, type Comment } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { EmojiPicker } from './emoji/EmojiPicker';
import { EmojiText } from './emoji/EmojiText';
import { MentionInput } from './emoji/MentionInput';

interface FeedItemProps {
  postId?: string;
  user: User;
  createdAt?: string;
  onUserClick?: () => void;
  postText?: string;
  postImageUrl?: string;
  postVideoUrl?: string;
  feeling?: string;
  stickerUrl?: string;
  initialReactionsCount?: Record<string, number>;
  initialReactedUsers?: Record<string, string[]>;
  initialComments?: Comment[];
  sharedPost?: Post;
  onShare?: () => void;
  onReact?: (type: string | null) => void;
  onComment?: (text: string, imageUrl?: string, stickerUrl?: string, replyToId?: string) => void;
  onCommentUserClick?: (user: User) => void;
}

function SharedPost({ post, isSub }: { post?: Post; isSub?: boolean }) {
  if (!post) return null;
  return (
    <div className={`rounded-xl overflow-hidden ${isSub ? 'mx-0 border-t-1' : 'mx-3 mb-3 border border-gray-200'} bg-gray-50 border-gray-200`}>
      <div className="p-3 flex items-center space-x-2 border-b border-gray-100 bg-white/60">
        <img src={post.user.profileImage} alt={post.user.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200" />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-gray-900">{post.user.name}</span>
            {post.feeling && (
              <span className="text-[11px] text-gray-400">กำลังรู้สึก <span className="text-gray-600">{post.feeling}</span></span>
            )}
          </div>
          <div className="text-[10px] text-gray-400">โพสต์ต้นฉบับ</div>
        </div>
      </div>
      <div className="bg-white">
        {post.videoUrl && (
          <div className="w-full aspect-video">
            <VideoPlayer src={post.videoUrl} autoPlay={false} />
          </div>
        )}
        {post.imageUrl && !post.videoUrl && (
          <img src={post.imageUrl} alt="Shared Post" className="w-full h-auto object-cover max-h-[280px]" />
        )}
        {post.text && <div className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{post.text}</div>}
        {post.stickerUrl && (
          <div className="p-3 flex justify-center">
            <img src={post.stickerUrl} alt="Sticker" className="w-20 h-20 object-contain" />
          </div>
        )}
      </div>
      {post.sharedPost && <SharedPost post={post.sharedPost} isSub />}
    </div>
  );
}

export const FeedItem: React.FC<FeedItemProps> = ({
  postId,
  user,
  createdAt,
  onUserClick,
  postText,
  postImageUrl,
  postVideoUrl,
  feeling,
  stickerUrl,
  initialReactionsCount = {},
  initialReactedUsers = {},
  initialComments,
  sharedPost,
  onShare,
  onReact,
  onComment,
  onCommentUserClick,
}) => {
  const [commentText, setCommentText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{id: string; name: string; profileImage: string}[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [comments, setComments] = useState<Comment[]>(
    (initialComments ?? []).map((c: any) => ({
      ...c,
      id: String(c.id ?? Date.now()),
      user: { ...c.user, id: String(c.user?.id ?? '') },
    }))
  );
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentSticker, setCommentSticker] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const commentImageRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const reactionPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [reactionsCount, setReactionsCount] = useState<Record<string, number>>(initialReactionsCount);
  const [reactedUsers, setReactedUsers] = useState<Record<string, string[]>>(initialReactedUsers);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showLikedByPopup, setShowLikedByPopup] = useState(false);
  const [likedByPopupData, setLikedByPopupData] = useState<{ type: string; color: string; users: string[] }[]>([]);
  const [likedByPopupPosition, setLikedByPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    // MentionInput จัดการ height เอง
  }, [commentText]);

  // รับ comment ใหม่ real-time สำหรับโพสต์นี้
  useEffect(() => {
    if (!postId) return;
    const unsub = net.on(PacketSC.NEW_COMMENT, (packet: Packet) => {
      const incomingPostId = String(packet.readInt());
      if (incomingPostId !== postId) return;
      const comment = JSON.parse(packet.readString()) as Comment;
      // ไม่เพิ่มซ้ำถ้าเป็น comment ที่เราส่งเอง (มีอยู่แล้วใน state)
      setComments(prev => {
        if (prev.some(c => c.id === comment.id)) return prev;
        return [...prev, { ...comment, id: String(comment.id), user: { ...comment.user, id: String(comment.user.id) } }];
      });
    });
    return () => unsub();
  }, [postId]);

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed && !commentImage && !commentSticker) return;

    let uploadedImageUrl: string | undefined;
    if (commentImageFile) {
      const form = new FormData();
      form.append('file', commentImageFile);
      form.append('source', 'chat');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json() as { url?: string };
      uploadedImageUrl = json.url;
    }

    // ส่งไป server — รอ NEW_COMMENT broadcast กลับมาแสดง (ไม่ optimistic add)
    onComment?.(trimmed, uploadedImageUrl || commentImage || undefined, commentSticker || undefined, replyTo?.id);

    setCommentText('');
    setCommentImage(null);
    setCommentImageFile(null);
    setCommentSticker(null);
    setReplyTo(null);
    setShowStickerPicker(false);
    setShowEmojiPicker(false);
  };

  const selectMention = (u: {id: string; name: string; profileImage: string}) => {
    const before = commentText.replace(/@\S*$/, `@${u.name} `);
    setCommentText(before);
    setMentionQuery(null);
    setMentionResults([]);
    setMentionIndex(0);
    // focus และวาง cursor ท้ายข้อความหลัง DOM update
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false); // ไปท้าย
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // mention navigation
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const u = mentionResults[mentionIndex];
        if (u) selectMention(u);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const reactions = [
    { name: 'ถูกใจ', icon: ThumbsUp, color: '#3b82f6', bg: '#eff6ff' },
    { name: 'รัก', icon: Heart, color: '#ef4444', bg: '#fef2f2' },
    { name: 'ฮ่าๆ', icon: Laugh, color: '#f59e0b', bg: '#fffbeb' },
    { name: 'เฉยๆ', icon: Annoyed, color: '#f97316', bg: '#fff7ed' },
    { name: 'เศร้า', icon: Frown, color: '#a855f7', bg: '#faf5ff' },
    { name: 'โกรธ', icon: Angry, color: '#b91c1c', bg: '#fef2f2' },
  ];

  const handleReactionToggle = (reactionName: string) => {
    setReactionsCount(prev => {
      const newCount = { ...prev };
      if (selectedReaction === reactionName) {
        newCount[reactionName] = (newCount[reactionName] || 1) - 1;
        setSelectedReaction(null);
        setReactedUsers(prevUsers => ({
          ...prevUsers,
          [reactionName]: (prevUsers[reactionName] || []).filter(n => n !== Global.user.name),
        }));
        onReact?.(null);
      } else {
        if (selectedReaction) {
          newCount[selectedReaction] = (newCount[selectedReaction] || 1) - 1;
          setReactedUsers(prevUsers => ({
            ...prevUsers,
            [selectedReaction]: (prevUsers[selectedReaction] || []).filter(n => n !== Global.user.name),
          }));
        }
        newCount[reactionName] = (newCount[reactionName] || 0) + 1;
        setSelectedReaction(reactionName);
        setReactedUsers(prevUsers => ({
          ...prevUsers,
          [reactionName]: [...(prevUsers[reactionName] || []), Global.user.name],
        }));
        onReact?.(reactionName);
      }
      return newCount;
    });
  };

  const totalReactions = Object.values(reactionsCount).reduce((acc, c) => acc + (c ?? 0), 0);
  const activeReactions = Object.keys(reactionsCount)
    .filter(name => (reactionsCount[name] ?? 0) > 0)
    .map(name => reactions.find(r => r.name === name))
    .filter((r): r is (typeof reactions)[0] => !!r);

  const currentReaction = reactions.find(r => r.name === selectedReaction);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 hover:shadow-md transition-shadow duration-300"
    >
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 cursor-pointer ring-2 ring-transparent hover:ring-[#5B65F2]/30 transition-all"
            onClick={onUserClick}
          >
            <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-x-1.5">
              <span
                className="font-bold text-gray-900 cursor-pointer hover:text-[#5B65F2] transition-colors text-[15px]"
                onClick={onUserClick}
              >
                {user.name}
              </span>
              {feeling && (
                <span className="text-gray-400 text-sm">
                  กำลังรู้สึก <span className="text-gray-600 font-medium">{feeling}</span>
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{
              (() => {
                const d = new Date(createdAt || Date.now());
                const now = new Date();
                const diff = now.getTime() - d.getTime();
                const mins = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);
                if (mins < 1) return 'เมื่อกี้';
                if (mins < 60) return `${mins} นาทีที่แล้ว`;
                if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
                if (days < 7) return `${days} วันที่แล้ว`;
                return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
              })()
            }</div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Post Content */}
      <div>
        {postText && (
          <div className="px-4 pb-3 text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap">
            <EmojiText text={postText} />
          </div>
        )}
        {postVideoUrl && (
          <div className="w-full aspect-video">
            <VideoPlayer src={postVideoUrl} autoPlay={false} />
          </div>
        )}
        {postImageUrl && !postVideoUrl && (
          <img src={postImageUrl} alt="Post" className="w-full h-auto object-cover max-h-[500px]" />
        )}
        {stickerUrl && (
          <div className="px-4 pb-3 flex justify-center">
            <img src={stickerUrl} alt="Sticker" className="w-36 h-36 object-contain" />
          </div>
        )}
        <SharedPost post={sharedPost} />
      </div>

      {/* Reaction Summary */}
      {totalReactions > 0 && (
        <div className="px-4 py-2 flex items-center border-t border-gray-50">
          <div className="flex -space-x-1 mr-2">
            {activeReactions.map((reaction, idx) => {
              const Icon = reaction.icon;
              return (
                <div
                  key={reaction.name}
                  className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                  style={{ backgroundColor: reaction.bg, zIndex: 10 - idx }}
                  onMouseEnter={(e) => {
                    if (window.innerWidth > 768) {
                      const popupData = activeReactions
                        .map(r => ({ type: r.name, color: r.color, users: reactedUsers[r.name] ?? [] }))
                        .filter(d => d.users.length > 0);
                      if (popupData.length > 0) {
                        setLikedByPopupData(popupData);
                        setLikedByPopupPosition({ x: e.clientX, y: e.clientY });
                        setShowLikedByPopup(true);
                      }
                    }
                  }}
                  onMouseMove={(e) => {
                    if (window.innerWidth > 768) setLikedByPopupPosition({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => { if (window.innerWidth > 768) setShowLikedByPopup(false); }}
                >
                  <Icon size={11} fill={reaction.color} stroke="#000" />
                </div>
              );
            })}
          </div>
          <span className="text-xs text-gray-500 hover:underline cursor-pointer">
            {totalReactions === 1 ? Object.values(reactedUsers).flat()[0] : `${totalReactions} คน`}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-2 py-1 border-t border-gray-100 flex items-center justify-between">
        {/* Like Button with Reaction Picker */}
        <div
          className="relative flex-1"
          onMouseEnter={() => {
            if (window.innerWidth > 768) {
              if (reactionPickerTimeoutRef.current) clearTimeout(reactionPickerTimeoutRef.current);
              setShowReactionPicker(true);
            }
          }}
          onMouseLeave={() => {
            if (window.innerWidth > 768) {
              reactionPickerTimeoutRef.current = setTimeout(() => setShowReactionPicker(false), 400);
            }
          }}
        >
          <AnimatePresence>
            {showReactionPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute bottom-full left-0 mb-2 px-2 py-1.5 bg-white rounded-2xl shadow-xl flex space-x-1 z-20 border border-gray-100"
              >
                {reactions.map((reaction) => {
                  const Icon = reaction.icon;
                  const isActive = selectedReaction === reaction.name;
                  return (
                    <button
                      key={reaction.name}
                      title={reaction.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionToggle(reaction.name);
                        setShowReactionPicker(false);
                      }}
                      className={`p-2 rounded-full transition-all hover:scale-125 active:scale-110 ${isActive ? 'scale-110' : ''}`}
                      style={{ backgroundColor: isActive ? reaction.bg : 'transparent' }}
                    >
                      <Icon
                        size={22}
                        fill={isActive ? reaction.color : 'none'}
                        stroke='#000'
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl transition-colors text-sm font-semibold ${
              selectedReaction ? 'text-[#5B65F2]' : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => {
              if (window.innerWidth <= 768) setShowReactionPicker(!showReactionPicker);
              else handleReactionToggle('ถูกใจ');
            }}
          >
            {currentReaction ? (
              <currentReaction.icon size={18} fill={currentReaction.color} stroke="#000" strokeWidth={1.5} />
            ) : (
              <ThumbsUp size={18} />
            )}
            <span>{selectedReaction || 'ถูกใจ'}</span>
          </button>
        </div>

        <button
          onClick={() => inputRef.current?.focus()}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-sm font-semibold"
        >
          <MessageCircle size={18} />
          <span>แสดงความเห็น</span>
        </button>

        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-sm font-semibold"
        >
          <Share2 size={18} />
          <span>แชร์</span>
        </button>
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="px-4 py-3 space-y-2.5 border-t border-gray-50">
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start space-x-2"
              >
                <img
                  src={comment.user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user.name}`}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl px-3 py-2">
                    <div
                      className="text-xs font-bold text-gray-900 mb-0.5 cursor-pointer hover:text-[#5B65F2] transition-colors"
                      onClick={() => onCommentUserClick?.(comment.user)}
                    >
                      {comment.user.name}
                    </div>
                    {/* @mention สำหรับ reply */}
                    {comment.replyToName && (
                      <span
                        className="text-xs text-[#5B65F2] font-medium mr-1 cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          // หา user จาก comment ที่ถูก reply
                          const replyUser = comments.find(c => c.id === comment.replyTo);
                          if (replyUser) onCommentUserClick?.(replyUser.user);
                        }}
                      >
                        @{comment.replyToName}
                      </span>
                    )}
                    {comment.text && <EmojiText
                      text={comment.text}
                      className="text-sm text-gray-700 whitespace-pre-wrap"
                      mentionUsers={comments.map(c => c.user)}
                      onMentionClick={(u) => onCommentUserClick?.(u)}
                    />}
                    {comment.imageUrl && (
                      <img src={comment.imageUrl} alt="comment" className="mt-1.5 max-w-[200px] rounded-xl object-cover" />
                    )}
                    {comment.stickerUrl && (
                      <img src={comment.stickerUrl} alt="sticker" className="mt-1 w-16 h-16 object-contain" />
                    )}
                  </div>
                  {/* Reply button — ชั้นแรกเท่านั้น */}
                  {!comment.replyTo && (
                    <button
                      onClick={() => { setReplyTo(comment); inputRef.current?.focus(); }}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#5B65F2] mt-1 ml-2 transition-colors"
                    >
                      <Reply size={12} /> ตอบกลับ
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Comment Input */}
      <div className="px-4 pb-3 pt-2">
        {/* Reply indicator */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-[#5B65F2]/5 rounded-xl border border-[#5B65F2]/10"
            >
              <Reply size={12} className="text-[#5B65F2]" />
              <span className="text-xs text-gray-500">ตอบกลับ <span className="font-semibold text-[#5B65F2]">{replyTo.user.name}</span></span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image/Sticker preview */}
        <AnimatePresence>
          {(commentImage || commentSticker) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-2 relative inline-block">
              <img
                src={commentImage || commentSticker || ''}
                alt="preview"
                className="max-h-24 rounded-xl object-contain border border-gray-100"
              />
              <button
                onClick={() => { setCommentImage(null); setCommentImageFile(null); setCommentSticker(null); }}
                className="absolute -top-1 -right-1 bg-gray-800 text-white p-0.5 rounded-full"
              >
                <X size={10} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticker picker */}
        <AnimatePresence>
          {showStickerPicker && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 p-2 bg-white border border-gray-100 rounded-2xl shadow-lg grid grid-cols-6 gap-1"
            >
              {['sticker1','sticker2','sticker3','sticker4','sticker5','sticker6'].map(s => {
                const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${s}`;
                return (
                  <button
                    key={s}
                    onClick={() => { setCommentSticker(url); setCommentImage(null); setCommentImageFile(null); setShowStickerPicker(false); }}
                    className={`p-1 rounded-xl hover:bg-gray-100 transition-all hover:scale-110 ${commentSticker === url ? 'bg-[#5B65F2]/10 ring-1 ring-[#5B65F2]' : ''}`}
                  >
                    <img src={url} alt={s} className="w-10 h-10 object-contain" />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end space-x-2">
          <img
            src={Global.user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Global.user.name}`}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 flex items-end bg-gray-100 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#5B65F2]/20 rounded-2xl px-3 py-2 transition-all border border-transparent focus-within:border-gray-200 relative">
            <MentionInput
              value={commentText}
              onChange={(val) => {                setCommentText(val);
                const match = val.match(/@(\S*)$/);
                if (match) {
                  const q = match[1]!;
                  setMentionQuery(q);
                  const seen = new Map<string, {id: string; name: string; profileImage: string}>();
                  comments.forEach(c => {
                    if (!seen.has(c.user.id) && c.user.name.toLowerCase().includes(q.toLowerCase())) {
                      seen.set(c.user.id, { id: c.user.id, name: c.user.name, profileImage: c.user.profileImage });
                    }
                  });
                  setMentionResults([...seen.values()].slice(0, 5));
                  setMentionIndex(0);
                } else {
                  setMentionQuery(null);
                  setMentionResults([]);
                }
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => { setMentionQuery(null); setMentionResults([]); }, 150)}
              placeholder={replyTo ? `ตอบกลับ ${replyTo.user.name}...` : 'แสดงความคิดเห็น...'}
              mentionUsers={comments.map(c => c.user)}
              onMentionClick={(u) => onCommentUserClick?.(u)}
              divRef={inputRef}
              className="text-gray-700"
            />
            {/* Mention dropdown */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-30 w-52">
                {mentionResults.map((u, i) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors ${i === mentionIndex ? 'bg-[#5B65F2]/10' : 'hover:bg-gray-50'}`}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    {/* คลิกรูปหรือชื่อ → ไปโปรไฟล์ */}
                    <img
                      src={u.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#5B65F2]"
                      onClick={() => onCommentUserClick?.({ id: u.id, name: u.name, profileImage: u.profileImage })}
                    />
                    <span
                      className="text-sm font-medium text-gray-800 truncate flex-1 cursor-pointer"
                      onClick={() => onCommentUserClick?.({ id: u.id, name: u.name, profileImage: u.profileImage })}
                    >
                      {u.name}
                    </span>
                    {/* คลิก @ → แทรก mention */}
                    <button
                      onMouseDown={(e) => { e.preventDefault(); selectMention(u); }}
                      className="text-[10px] text-[#5B65F2] font-bold px-1.5 py-0.5 rounded bg-[#5B65F2]/10 hover:bg-[#5B65F2]/20 flex-shrink-0"
                    >
                      @
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center space-x-1.5 text-gray-400 ml-2 mb-0.5 relative">
              <div className="relative">
                <button
                  onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false); }}
                  className={`hover:text-yellow-500 transition-colors ${showEmojiPicker ? 'text-yellow-500' : ''}`}
                >
                  <span className="text-base">😊</span>
                </button>
                <EmojiPicker
                  open={showEmojiPicker}
                  onSelect={(id) => setCommentText(prev => prev + `:${id}:`)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
              <button
                onClick={() => { setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false); }}
                className={`hover:text-purple-500 transition-colors ${showStickerPicker ? 'text-purple-500' : ''}`}
              >
                <StickyNote size={18} />
              </button>
              <button onClick={() => commentImageRef.current?.click()} className="hover:text-green-500 transition-colors">
                <ImageIcon size={18} />
              </button>
              {(commentText.trim() || commentImage || commentSticker) && (
                <button onClick={handleSendComment} className="text-[#5B65F2] hover:text-[#4a54e1] transition-colors">
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={commentImageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCommentImageFile(file);
            setCommentImage(URL.createObjectURL(file));
            e.target.value = '';
          }}
        />
      </div>

      {/* Liked By Popup */}
      {showLikedByPopup && (
        <div
          className="fixed glass-dark text-white text-[11px] py-2.5 px-3 rounded-2xl shadow-2xl z-[9999] pointer-events-none min-w-[130px]"
          style={{ left: likedByPopupPosition.x, top: likedByPopupPosition.y - 12, transform: 'translate(-50%, -100%)' }}
        >
          <div className="flex flex-col gap-2">
            {likedByPopupData.map((data, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <span className="font-bold" style={{ color: data.color }}>{data.type}</span>
                  <span className="text-[10px] opacity-50">({data.users.length})</span>
                </div>
                <div className="flex flex-col gap-0.5 pl-1">
                  {data.users.slice(0, 5).map((name, uIdx) => (
                    <div key={uIdx} className="whitespace-nowrap opacity-90">{name}</div>
                  ))}
                  {data.users.length > 5 && (
                    <div className="whitespace-nowrap opacity-50 italic">+{data.users.length - 5} คน</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-black/40" />
        </div>
      )}
    </motion.div>
  );
};
