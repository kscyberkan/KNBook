import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { Search, Bell, MessageSquare, Heart, Share2, MoreHorizontal } from 'lucide-react-native';
import net from '../network/client';
import { PacketSC } from '../../../src/user/network/packetList';
import { CONFIG } from '../config';
import { useDictionary } from '../utils/dictionary';

interface Post {
    id: string;
    text: string;
    userName: string;
    userImage?: string;
    createdAt?: string;
    likes?: number;
    comments?: number;
}

export default function Feed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { t } = useDictionary();

    useEffect(() => {
        net.connect(CONFIG.WS_URL);
        const unsub = net.on(PacketSC.POST_LIST, (packet) => {
            const data = JSON.parse(packet.readString()) as Post[];
            setPosts(data);
            setRefreshing(false);
        });

        return () => unsub();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
    };

    const renderItem = ({ item }: { item: Post }) => (
        <View style={styles.postCard}>
            <View style={styles.postHeader}>
                <View style={styles.userInfo}>
                    <Image 
                        source={{ uri: item.userImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userName}` }} 
                        style={styles.avatar} 
                    />
                    <View>
                        <Text style={styles.userName}>{item.userName}</Text>
                        <Text style={styles.timeText}>{t('common.justNow')}</Text>
                    </View>
                </View>
                <TouchableOpacity>
                    <MoreHorizontal size={20} color="#9CA3AF" />
                </TouchableOpacity>
            </View>

            <Text style={styles.postText}>{item.text}</Text>

            <View style={styles.postFooter}>
                <View style={styles.actionGroup}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Heart size={20} color="#6B7280" />
                        <Text style={styles.actionText}>{item.likes || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <MessageSquare size={20} color="#6B7280" />
                        <Text style={styles.actionText}>{item.comments || 0}</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.actionButton}>
                    <Share2 size={20} color="#6B7280" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logo}>KN<Text style={{ color: '#111827' }}>Book</Text></Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconCircle}>
                        <Search size={20} color="#4B5563" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconCircle}>
                        <Bell size={20} color="#4B5563" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5B65F2']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{t('common.noPosts')}</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' },
    logo: { fontSize: 24, fontWeight: '900', color: '#5B65F2', letterSpacing: -1 },
    headerIcons: { flexDirection: 'row', gap: 10 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 15 },
    postCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    userInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB', marginRight: 12 },
    userName: { fontSize: 16, fontWeight: '700', color: '#111827' },
    timeText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    postText: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 16 },
    postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    actionGroup: { flexDirection: 'row', gap: 20 },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#9CA3AF', fontSize: 16 },
});
