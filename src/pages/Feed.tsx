import React, { useEffect, useRef, useCallback } from "react";
import { CreatePost } from "../components/CreatePost";
import { FeedItem } from "../components/FeedItem";
import { type Post, type User } from "../types";
import net, { PacketSC } from "../network/client";
import Packet from "../network/packet";

interface FeedProps {
    onUserClick?: (user: User) => void;
    onSharePost?: () => void;
}

function Feed({ onUserClick, onSharePost }: FeedProps) {
    const [posts, setPosts] = React.useState<Post[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const offsetRef = useRef(0);
    const isFetchingRef = useRef(false);

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

        const unsubResume = net.on(PacketSC.RESUME_OK, (packet: Packet) => {
            const userId = packet.readInt();

            console.log('[Feed] Resume OK, user id:', userId);
            net.getFeed(0);
        })

        net.getFeed(0);
        return () => { unsubList(); unsubNew(); unsubReaction(); unsubComment(); unsubDel(); unsubResume(); };
    }, []);

    const loadMore = useCallback(() => {
        if (isFetchingRef.current || !hasMore) return;
        isFetchingRef.current = true;
        setLoadingMore(true);
        net.getFeed(offsetRef.current);
    }, [hasMore]);

    const handleNewPost = async (postData: {
        text: string;
        imageUrl: string | null;
        videoUrl: string | null;
        imageFile?: File | null;
        videoFile?: File | null;
        feeling: string | null;
        stickerUrl: string | null;
    }) => {
        await net.createPost({
            text: postData.text || undefined,
            imageFile: postData.imageFile,
            videoFile: postData.videoFile,
            feeling: postData.feeling,
            stickerUrl: postData.stickerUrl,
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
                    <p className="text-sm text-gray-400">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1">
            <div className="max-w-[720px] mx-auto w-full py-4 md:py-6 px-3 md:px-4">
                <CreatePost onPost={handleNewPost} />

                <div className="space-y-4 md:space-y-6">
                    {posts.map((post) => {
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
                                sharedPost={post.sharedPost}
                                initialReactionsCount={reactionsCount}
                                initialReactedUsers={reactedUsers}
                                initialComments={post.comments}
                                onShare={() => handleShare(post)}
                                onReact={(type) => handleReact(post.id, type)}
                                onComment={(text, img, sticker, replyToId) => handleComment(post.id, text, img, sticker, replyToId)}
                                onCommentUserClick={(u) => onUserClick?.(u)}
                            />
                        );
                    })}

                    {posts.length === 0 && (
                        <div className="text-center py-16 text-gray-400 text-sm">ยังไม่มีโพสต์</div>
                    )}
                </div>

                {/* Load more */}
                <div className="py-6 flex justify-center">
                    {loadingMore ? (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <div className="w-5 h-5 border-2 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                            <span>กำลังโหลดเพิ่ม...</span>
                        </div>
                    ) : hasMore ? (
                        <button
                            onClick={loadMore}
                            className="px-6 py-2.5 bg-white border border-gray-200 hover:border-[#5B65F2]/40 hover:bg-[#5B65F2]/5 text-gray-600 hover:text-[#5B65F2] rounded-xl text-sm font-medium transition-all shadow-sm"
                        >
                            โหลดเพิ่ม
                        </button>
                    ) : posts.length > 0 ? (
                        <p className="text-xs text-gray-300">— โพสต์ทั้งหมด {posts.length} รายการ —</p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default Feed;
