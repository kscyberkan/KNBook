import React, { useRef, useEffect, useState } from 'react';
import { Global } from '../Global';
import { MapPin, Calendar, Edit2, Camera, Grid3X3, BookOpen } from 'lucide-react';
import { FeedItem } from '../components/FeedItem';
import { type Post, type User } from '../types';
import { motion } from 'framer-motion';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { modal } from '../components/Modal';
import { FriendButton } from '../components/FriendButton';
import { updateStoredField } from '../auth/function';

interface ProfileProps {
  user?: User;
  onEditClick?: () => void;
  onSharePost?: () => void;
  onUserClick?: (user: User) => void;
}

export default function Profile({ user, onEditClick, onSharePost, onUserClick }: ProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const displayUser: User = user || Global.user;
  const isMe = displayUser.id === Global.user.id;

  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const isFetchingRef = React.useRef(false);
  const [profileImage, setProfileImage] = useState(displayUser.profileImage);
  const [coverImage, setCoverImage] = useState(displayUser.coverImage);

  // sync รูปเมื่อ displayUser เปลี่ยน หรือเมื่อ server ยืนยัน upload สำเร็จ
  useEffect(() => {
    setProfileImage(displayUser.profileImage);
    setCoverImage(displayUser.coverImage);
  }, [displayUser.id, displayUser.profileImage, displayUser.coverImage]);

  // รับ update จาก server เมื่อ upload profile/cover image สำเร็จ
  useEffect(() => {
    if (!isMe) return;
    const unsub = net.on(PacketSC.PROFILE_IMAGE_UPDATED, (packet: Packet) => {
      const _userId = packet.readInt();
      const url = packet.readString();
      setProfileImage(url);
    });

    const unsubCover = net.on(PacketSC.COVER_IMAGE_UPDATED, (packet: Packet) => {
      const _userId = packet.readInt();
      const url = packet.readString();

      setCoverImage(url);
    });
    return () => { unsub(); unsubCover() };
  }, [isMe]);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none');

  // โหลดโพสต์
  useEffect(() => {
    setLoading(true);
    offsetRef.current = 0;

    const unsub = net.on(PacketSC.USER_POST_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as Post[];
      const more = packet.readBool();
      if (offsetRef.current === 0) {
        setPosts(data);
        setLoading(false);
      } else {
        setPosts(prev => [...prev, ...data]);
        setLoadingMore(false);
      }
      setHasMore(more);
      offsetRef.current += data.length;
      isFetchingRef.current = false;
    });

    net.getUserPosts(Number(displayUser.id), 0);

    return () => unsub();
  }, [displayUser.id]);

  // โหลด friend status
  useEffect(() => {
    if (isMe) return;
    net.getFriendStatus(Number(displayUser.id));
    const unsub = net.on(PacketSC.FRIEND_STATUS, (packet: Packet) => {
      const targetId = packet.readInt();
      if (String(targetId) === displayUser.id) {
        setFriendStatus(packet.readString() as typeof friendStatus);
      }
    });
    return () => unsub();
  }, [displayUser.id, isMe]);

  const loadMore = () => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    net.getUserPosts(Number(displayUser.id), offsetRef.current);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setProfileImage(localUrl);
    Global.user.profileImage = localUrl;
    net.uploadProfileImage(file, Global.user.id)
      .then(url => {
        setProfileImage(url);
        Global.user.profileImage = url;
        updateStoredField({ profileImage: url });
        modal.success('อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว');
      })
      .catch(() => modal.error('อัปโหลดรูปไม่สำเร็จ'));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setCoverImage(localUrl);
    Global.user.coverImage = localUrl;
    net.uploadCoverImage(file, Global.user.id)
      .then(url => {
        setCoverImage(url);
        Global.user.coverImage = url;
        updateStoredField({ coverImage: url });
        modal.success('อัปเดตรูปหน้าปกเรียบร้อยแล้ว');
      })
      .catch(() => modal.error('อัปโหลดรูปไม่สำเร็จ'));
  };

  const handleShare = async (originalPost: Post) => {
    await net.createPost({ sharedFromId: Number(originalPost.id) });
    onSharePost?.();
  };

  const handleReact = (postId: string, type: string | null) => {
    if (type) net.reactPost(Number(postId), type);
    else net.unreactPost(Number(postId));
  };

  const handleComment = (postId: string, text: string, imageUrl?: string, stickerUrl?: string, replyToId?: string) => {
    net.createComment(Number(postId), text, imageUrl, stickerUrl, replyToId ? Number(replyToId) : undefined);
  };

  const stats = [
    { label: 'โพสต์', value: posts.length },
    { label: 'เพื่อน', value: '—' },
  ];

  const avatarSrc = profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayUser.name}`;

  const joinedDate = displayUser.createdAt
    ? new Date(displayUser.createdAt).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    : 'KN Book';

  return (
    <div className="flex-1 bg-[#F0F2F5]">
      <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
      <input type="file" ref={coverInputRef} onChange={handleCoverChange} accept="image/*" className="hidden" />

      {/* Cover + Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="h-52 md:h-72 relative overflow-hidden group">
            <img src={coverImage || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop"} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            {isMe && (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/90 hover:bg-white text-gray-700 rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-all text-sm font-semibold"
              >
                <Camera size={16} /> แก้ไขรูปหน้าปก
              </button>
            )}
          </div>

          <div className="px-4 md:px-6 pb-5 relative">
            {/* Mobile */}
            <div className="md:hidden flex flex-col items-center text-center -mt-16 relative z-10">
              <div className="relative group mb-3">
                <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-200 shadow-xl">
                  <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                </div>
                {isMe && (
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 p-2 bg-[#5B65F2] hover:bg-[#4a54e1] text-white rounded-full border-2 border-white shadow-lg transition-all hover:scale-110">
                    <Camera size={15} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{displayUser.name}</h1>
                {displayUser.nickname && <span className="text-gray-500 text-lg">({displayUser.nickname})</span>}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-3 flex-wrap">
                {stats.map((stat, i) => (
                  <span key={stat.label} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 mr-1">•</span>}
                    <span className="font-semibold text-gray-700">{stat.value}</span> {stat.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                {isMe ? (
                  <button onClick={onEditClick} className="flex items-center gap-2 px-5 py-2 bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-semibold rounded-xl shadow-md text-sm transition-all">
                    <Edit2 size={14} /> แก้ไขโปรไฟล์
                  </button>
                ) : (
                  <FriendButton targetId={displayUser.id} status={friendStatus} onStatusChange={setFriendStatus} size="sm" />
                )}
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin size={11} /> {displayUser.province || '—'}</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> เข้าร่วม {joinedDate}</span>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex items-end justify-between -mt-16 relative z-10">
              <div className="flex items-end gap-4">
                <div className="relative group flex-shrink-0">
                  <div className="w-36 h-36 rounded-full border-4 border-white overflow-hidden bg-gray-200 shadow-xl">
                    <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  {isMe && (
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 p-2 bg-[#5B65F2] hover:bg-[#4a54e1] text-white rounded-full border-2 border-white shadow-lg transition-all hover:scale-110">
                      <Camera size={16} />
                    </button>
                  )}
                </div>
                <div className="pb-2 pt-20">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">{displayUser.name}</h1>
                    {displayUser.nickname && (
                      <span className="inline-flex items-center bg-[#5B65F2]/10 text-[#5B65F2] text-xs px-2.5 py-1 rounded-full font-semibold">{displayUser.nickname}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">@{displayUser.id}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {displayUser.province || '—'}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> เข้าร่วม {joinedDate}</span>
                  </div>
                  <div className="flex items-center gap-6 mt-2">
                    {stats.map(stat => (
                      <div key={stat.label}>
                        <span className="font-bold text-gray-900 text-sm">{stat.value}</span>
                        <span className="text-xs text-gray-400 ml-1">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pb-2 flex-shrink-0">
                {isMe ? (
                  <button onClick={onEditClick} className="flex items-center gap-2 px-5 py-2.5 bg-[#5B65F2] hover:bg-[#4a54e1] text-white font-semibold rounded-xl shadow-md shadow-[#5B65F2]/20 transition-all hover:-translate-y-0.5 text-sm">
                    <Edit2 size={15} /> แก้ไขโปรไฟล์
                  </button>
                ) : (
                  <FriendButton targetId={displayUser.id} status={friendStatus} onStatusChange={setFriendStatus} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} className="text-[#5B65F2]" />
                <h2 className="font-bold text-gray-900">แนะนำตัวเอง</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed italic text-center py-1 whitespace-pre-wrap">
                {displayUser.bio ? `"${displayUser.bio}"` : isMe ? '"ยังไม่มีคำแนะนำตัว..."' : '"ยินดีที่ได้รู้จักทุกคนครับ ✨"'}
              </p>
              <div className="mt-4 pt-4 border-t border-gray-50 space-y-2.5">
                {displayUser.phone && isMe && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">เบอร์โทร</span>
                    <span className="font-semibold text-gray-700">{displayUser.phone}</span>
                  </div>
                )}
                {stats.map(stat => (
                  <div key={stat.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{stat.label}</span>
                    <span className="font-semibold text-gray-700">{stat.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-2">
              <Grid3X3 size={16} className="text-[#5B65F2]" />
              <span className="font-bold text-gray-800 text-sm">{isMe ? 'โพสต์ของคุณ' : `โพสต์ของ ${displayUser.name}`}</span>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{posts.length} โพสต์</span>
            </motion.div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
              </div>
            ) : posts.length > 0 ? (
              posts.map((post, i) => {
                const reactionsCount: Record<string, number> = {};
                const reactedUsers: Record<string, string[]> = {};
                (post.reactions ?? []).forEach(r => {
                  reactionsCount[r.type] = r.users.length;
                  reactedUsers[r.type] = r.users;
                });
                return (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <FeedItem
                      postId={post.id}
                      user={post.user}
                      createdAt={post.createdAt}
                      postText={post.text}
                      postImageUrl={post.imageUrl}
                      postVideoUrl={post.videoUrl}
                      feeling={post.feeling}
                      stickerUrl={post.stickerUrl}
                      sharedPost={post.sharedPost}
                      initialReactionsCount={reactionsCount}
                      initialReactedUsers={reactedUsers}
                      initialComments={post.comments}
                      onShare={() => handleShare(post)}
                      onReact={(type) => handleReact(post.id, type)}
                      onComment={(text, img, sticker, replyToId) => handleComment(post.id, text, img, sticker, replyToId)}
                      onCommentUserClick={(u) => onUserClick?.(u)}
                    />
                  </motion.div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
                <Grid3X3 size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีโพสต์</p>
              </div>
            )}

            {posts.length > 0 && (
              <div className="py-4 flex justify-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-5 h-5 border-2 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                    <span>กำลังโหลดเพิ่ม...</span>
                  </div>
                ) : hasMore ? (
                  <button onClick={loadMore} className="px-6 py-2.5 bg-white border border-gray-200 hover:border-[#5B65F2]/40 hover:bg-[#5B65F2]/5 text-gray-600 hover:text-[#5B65F2] rounded-xl text-sm font-medium transition-all shadow-sm">
                    โหลดเพิ่ม
                  </button>
                ) : (
                  <p className="text-xs text-gray-300">— โพสต์ทั้งหมด {posts.length} รายการ —</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
