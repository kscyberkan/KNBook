import React, { useEffect, useRef, useCallback, useState } from "react";
import { CreatePost } from "../components/CreatePost";
import { FeedItem } from "../components/FeedItem";
import { type Post, type User } from "../../types";
import net, { PacketSC } from "../network/client";
import Packet from "../network/packet";
import { Users, Globe, LayoutGrid, ChevronDown, Search, Check, X } from "lucide-react";
import { useDictionary } from "../../utils/dictionary";
import { AnimatePresence, motion } from "framer-motion";

interface FeedProps {
    onUserClick?: (user: User) => void;
    onSharePost?: () => void;
}

type FeedFilter = 'all' | 'group' | 'general';

function Feed({ onUserClick, onSharePost }: FeedProps) {
    const [posts, setPosts] = React.useState<Post[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FeedFilter>('all');
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef(0);
    const isFetchingRef = useRef(false);
    const { t, tp } = useDictionary();

    // ปิด dropdown เมื่อคลิกนอก
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
                setGroupSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        // subscribe ก่อน แล้วค่อย request
        const unsubList = net.on(PacketSC.POST_LIST, (packet: Packet) => {
            const data = JSON.parse(packet.readString()) as Post[]; const more = packet.readBool();

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

        const unsubNew = net.on(PacketSC.NEW_POST, (packet: Packet) => {
            const post = JSON.parse(packet.readString()) as Post;
            setPosts(prev => [post, ...prev]);
            offsetRef.current += 1;
        });

        const unsubReaction = net.on(PacketSC.REACTION_UPDATE, (packet: Packet) => {
            const postId = String(packet.readInt());
            const { userId, type } = JSON.parse(packet.readString()) as { userId: number; type: string | null };
            setPosts(prev => prev.map(p => {
                if (p.id !== postId) return p;
                const reactions = [...p.reactions];
                if (type === null) {
                    return { ...p, reactions: reactions.map(r => ({ ...r, users: r.users.filter(u => u !== String(userId)) })) };
                }
                const existing = reactions.find(r => r.type === type);
                if (existing) {
                    return { ...p, reactions: reactions.map(r => r.type === type ? { ...r, users: [...r.users, String(userId)] } : r) };
                }
                return { ...p, reactions: [...reactions, { type, users: [String(userId)] }] };
            }));
        });

        const unsubComment = net.on(PacketSC.NEW_COMMENT, (_packet: Packet) => {
            // FeedItem จัดการ NEW_COMMENT เอง
        });

        const unsubDel = net.on(PacketSC.POST_DELETED, (packet: Packet) => {
            const postId = String(packet.readInt());
            setPosts(prev => prev.filter(p => p.id !== postId));
            offsetRef.current = Math.max(0, offsetRef.current - 1);
        });

        const unsubEdit = net.on(PacketSC.POST_UPDATED, (packet: Packet) => {
            const postId = String(packet.readInt());
            const text = packet.readString();
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, text: text || undefined } : p));
        });

        const unsubBookmark = net.on(PacketSC.BOOKMARK_UPDATE, (packet: Packet) => {
            const postId = String(packet.readInt());
            const saved = packet.readBool();
            setBookmarkedIds(prev => {
                const next = new Set(prev);
                saved ? next.add(postId) : next.delete(postId);
                return next;
            });
        });

        const unsubBookmarkIds = net.on(PacketSC.BOOKMARK_IDS, (packet: Packet) => {
            const ids = JSON.parse(packet.readString()) as string[];
            setBookmarkedIds(new Set(ids));
        });

        const unsubResume = net.on(PacketSC.RESUME_OK, (packet: Packet) => {
            const userId = packet.readInt();

            console.log('[Feed] Resume OK, user id:', userId);
            net.getFeed(0);
        })

        net.getFeed(0);
        net.getBookmarkIds();
        return () => { unsubList(); unsubNew(); unsubReaction(); unsubComment(); unsubDel(); unsubEdit(); unsubBookmark(); unsubBookmarkIds(); unsubResume(); };
    }, []);

    const loadMore = useCallback(() => {
        if (isFetchingRef.current || !hasMore) return;
        isFetchingRef.current = true;
        setLoadingMore(true);
        net.getFeed(offsetRef.current);
    }, [hasMore]);

    // Intersection Observer — auto load more เมื่อ scroll ถึง sentinel
    const sentinelRef = useRef<HTMLDivElement>(null);
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

    const handleNewPost = async (postData: {
        text: string;
        imageUrl: string | null;
        videoUrl: string | null;
        imageFile?: File | null;
        videoFile?: File | null;
        feeling: string | null;
        stickerUrl: string | null;
        groupName?: string | null;
    }) => {
        await net.createPost({
            text: postData.text || undefined,
            imageFile: postData.imageFile,
            videoFile: postData.videoFile,
            feeling: postData.feeling,
            stickerUrl: postData.stickerUrl,
            groupName: postData.groupName ?? undefined,
        });
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

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">{t('feed.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1">
            <div className="max-w-[720px] mx-auto w-full py-4 md:py-6 px-3 md:px-4">
                <CreatePost onPost={handleNewPost} />

                {/* Filter Dropdown */}
                {(() => {
                    const groupNames = Array.from(
                        new Set(posts.filter(p => !!p.groupName).map(p => p.groupName!))
                    ).sort();
                    const filteredGroups = groupNames.filter(n =>
                        n.toLowerCase().includes(groupSearch.toLowerCase())
                    );

                    const filterOptions = [
                        { key: 'all' as FeedFilter,     label: t('feed.all'),       icon: LayoutGrid },
                        { key: 'general' as FeedFilter, label: t('feed.general'),   icon: Globe },
                        { key: 'group' as FeedFilter,   label: t('feed.fromGroup'), icon: Users },
                    ];

                    const activeLabel = filter === 'group' && selectedGroup
                        ? selectedGroup
                        : filterOptions.find(o => o.key === filter)?.label ?? t('feed.all');
                    const ActiveIcon = filter === 'group' ? Users : filterOptions.find(o => o.key === filter)?.icon ?? LayoutGrid;

                    return (
                        <div ref={dropdownRef} className="relative mb-4">
                            {/* Trigger button */}
                            <button
                                onClick={() => { setDropdownOpen(v => !v); setGroupSearch(''); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:border-[#5B65F2]/50 hover:text-[#5B65F2] transition-all duration-150 min-w-[160px]"
                            >
                                <ActiveIcon size={15} className={filter !== 'all' ? 'text-[#5B65F2]' : 'text-gray-400'} />
                                <span className="flex-1 text-left truncate">{activeLabel}</span>
                                {filter !== 'all' && (
                                    <span
                                        role="button"
                                        onClick={e => { e.stopPropagation(); setFilter('all'); setSelectedGroup(null); setDropdownOpen(false); }}
                                        className="text-gray-300 hover:text-gray-500 transition-colors"
                                    >
                                        <X size={13} />
                                    </span>
                                )}
                                <ChevronDown
                                    size={14}
                                    className={`text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {/* Dropdown panel */}
                            <AnimatePresence>
                                {dropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                        className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30"
                                    >
                                        {/* Main filter options */}
                                        <div className="p-1.5 border-b border-gray-50">
                                            {filterOptions.map(({ key, label, icon: Icon }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        setFilter(key);
                                                        setSelectedGroup(null);
                                                        if (key !== 'group') { setDropdownOpen(false); setGroupSearch(''); }
                                                    }}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                                                        filter === key && !selectedGroup
                                                            ? 'bg-[#5B65F2]/8 text-[#5B65F2] font-medium'
                                                            : 'text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <Icon size={15} className={filter === key && !selectedGroup ? 'text-[#5B65F2]' : 'text-gray-400'} />
                                                    <span className="flex-1 text-left">{label}</span>
                                                    {filter === key && !selectedGroup && <Check size={13} className="text-[#5B65F2]" />}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Group list — แสดงเมื่อมีกลุ่ม */}
                                        {groupNames.length > 0 && (
                                            <div className="p-1.5">
                                                {/* Search box */}
                                                <div className="flex items-center gap-2 px-3 py-1.5 mb-1 bg-gray-50 rounded-xl">
                                                    <Search size={13} className="text-gray-400 flex-shrink-0" />
                                                    <input
                                                        type="text"
                                                        value={groupSearch}
                                                        onChange={e => setGroupSearch(e.target.value)}
                                                        placeholder={t('common.search') + '...'}
                                                        className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                    {groupSearch && (
                                                        <button onClick={() => setGroupSearch('')} className="text-gray-300 hover:text-gray-500">
                                                            <X size={11} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Group items */}
                                                <div className="max-h-48 overflow-y-auto">
                                                    {filteredGroups.length === 0 ? (
                                                        <p className="text-xs text-gray-400 text-center py-3">{t('common.noData')}</p>
                                                    ) : (
                                                        filteredGroups.map(name => (
                                                            <button
                                                                key={name}
                                                                onClick={() => {
                                                                    setFilter('group');
                                                                    setSelectedGroup(prev => prev === name ? null : name);
                                                                    setDropdownOpen(false);
                                                                    setGroupSearch('');
                                                                }}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                                                                    selectedGroup === name
                                                                        ? 'bg-[#5B65F2]/8 text-[#5B65F2] font-medium'
                                                                        : 'text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <Users size={13} className={selectedGroup === name ? 'text-[#5B65F2]' : 'text-gray-400'} />
                                                                <span className="flex-1 text-left truncate">{name}</span>
                                                                {selectedGroup === name && <Check size={13} className="text-[#5B65F2]" />}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })()}

                <div className="space-y-4 md:space-y-6">
                    {posts
                        .filter(post => {
                            if (filter === 'group') {
                                if (!post.groupName) return false;
                                if (selectedGroup) return post.groupName === selectedGroup;
                                return true;
                            }
                            if (filter === 'general') return !post.groupName;
                            return true;
                        })
                        .map((post) => {
                        const reactionsCount: Record<string, number> = {};
                        const reactedUsers: Record<string, string[]> = {};
                        (post.reactions ?? []).forEach(r => {
                            reactionsCount[r.type] = r.users.length;
                            reactedUsers[r.type] = r.users;
                        });
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
                                groupName={post.groupName}
                                sharedPost={post.sharedPost}
                                initialReactionsCount={reactionsCount}
                                initialReactedUsers={reactedUsers}
                                initialComments={post.comments}
                                onShare={() => handleShare(post)}
                                onReact={(type) => handleReact(post.id, type)}
                                onComment={(text, img, sticker, replyToId) => handleComment(post.id, text, img, sticker, replyToId)}
                                onCommentUserClick={(u) => onUserClick?.(u)}
                                initialBookmarked={bookmarkedIds.has(post.id)}
                                onBookmark={(saved) => saved ? net.bookmarkPost(Number(post.id)) : net.unbookmarkPost(Number(post.id))}
                            />
                        );
                    })}

                    {posts.length === 0 && (
                        <div className="text-center py-16 text-gray-400 text-sm">{t('feed.noPosts')}</div>
                    )}
                    {posts.length > 0 && posts.filter(post => {
                        if (filter === 'group') {
                            if (!post.groupName) return false;
                            if (selectedGroup) return post.groupName === selectedGroup;
                            return true;
                        }
                        if (filter === 'general') return !post.groupName;
                        return true;
                    }).length === 0 && (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            {filter === 'group'
                                ? selectedGroup
                                    ? tp('feed.noGroupPostsNamed', { name: selectedGroup })
                                    : t('feed.noGroupPosts')
                                : t('feed.noGeneralPosts')}
                        </div>
                    )}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="py-6 flex justify-center">
                    {loadingMore && (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <div className="w-5 h-5 border-2 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                            <span>{t('feed.loadingMore')}</span>
                        </div>
                    )}
                    {!hasMore && posts.length > 0 && (
                        <p className="text-xs text-gray-300">{tp('feed.allPostsCount', { n: posts.length })}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Feed;
