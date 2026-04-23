import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bookmark, ArrowLeft } from 'lucide-react';
import { FeedItem } from '../components/FeedItem';
import { type Post, type User } from '../types';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';

interface Props {
  onUserClick?: (user: User) => void;
  onBack?: () => void;
}

export default function Bookmarks({ onUserClick, onBack }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = net.on(PacketSC.BOOKMARK_LIST, (packet: Packet) => {
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
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        data.forEach(p => next.add(p.id));
        return next;
      });
      offsetRef.current += data.length;
      isFetchingRef.current = false;
    });

    const unsubUpdate = net.on(PacketSC.BOOKMARK_UPDATE, (packet: Packet) => {
      const postId = String(packet.readInt());
      const saved = packet.readBool();
      if (!saved) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setBookmarkedIds(prev => { const n = new Set(prev); n.delete(postId); return n; });
        offsetRef.current = Math.max(0, offsetRef.current - 1);
      }
    });

    net.getBookmarks(0);
    return () => { unsub(); unsubUpdate(); };
  }, []);

  const loadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    net.getBookmarks(offsetRef.current);
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="flex-1">
      <div className="max-w-[720px] mx-auto w-full py-4 md:py-6 px-3 md:px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Bookmark size={20} className="text-[#5B65F2]" fill="currentColor" />
            <h1 className="font-bold text-gray-900 text-lg">โพสต์ที่บันทึก</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Bookmark size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">ยังไม่มีโพสต์ที่บันทึก</p>
            <p className="text-xs mt-1 opacity-70">กด 🔖 บนโพสต์เพื่อบันทึกไว้ดูทีหลัง</p>
          </div>
        ) : (
        <>
          {posts.map(post => {
            const reactionsCount = Object.fromEntries((post.reactions ?? []).map(r => [r.type, r.users.length]));
            const reactedUsers = Object.fromEntries((post.reactions ?? []).map(r => [r.type, r.users]));
            return (
              <FeedItem
                key={post.id}
                postId={post.id}
                user={post.user}
                createdAt={post.createdAt}
                onUserClick={() => onUserClick?.(post.user)}
                postText={post.text}
                postImageUrl={post.imageUrl}
                postVideoUrl={post.videoUrl}
                feeling={post.feeling}
                stickerUrl={post.stickerUrl}
                sharedPost={post.sharedPost}
                initialReactionsCount={reactionsCount}
                initialReactedUsers={reactedUsers}
                initialComments={post.comments}
                initialBookmarked={bookmarkedIds.has(post.id)}
                onBookmark={(saved) => saved ? net.bookmarkPost(Number(post.id)) : net.unbookmarkPost(Number(post.id))}
                onReact={(type) => type ? net.reactPost(Number(post.id), type) : net.unreactPost(Number(post.id))}
                onComment={(text, img, sticker, replyToId) => net.createComment(Number(post.id), text, img, sticker, replyToId ? Number(replyToId) : undefined)}
                onShare={() => net.createPost({ sharedFromId: Number(post.id) })}
                onCommentUserClick={(u) => onUserClick?.(u)}
              />
            );
          })}

          <div ref={sentinelRef} className="py-6 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-5 h-5 border-2 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                <span>กำลังโหลดเพิ่ม...</span>
              </div>
            )}
            {!hasMore && (
              <p className="text-xs text-gray-300">— บันทึกทั้งหมด {posts.length} รายการ —</p>
            )}
          </div>
        </>
        )}
      </div>
    </div>
  );
}
