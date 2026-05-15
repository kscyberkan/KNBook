import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView } from 'react-native';
import { User, Settings, Shield, Bell, ChevronRight, LogOut, Globe } from 'lucide-react-native';
import { useDictionary, type Lang } from '../utils/dictionary';
import { useGlobal } from '../utils/GlobalContext';

export default function Profile() {
    const { t, lang, setLang } = useDictionary();
    const { user, logout } = useGlobal();

    const langs: { value: Lang; label: string; flag: string }[] = [
        { value: 'th', label: 'ไทย', flag: '🇹🇭' },
        { value: 'en', label: 'En', flag: '🇺🇸' },
        { value: 'cn', label: '中文', flag: '🇨🇳' },
        { value: 'jp', label: '日本語', flag: '🇯🇵' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                <View style={styles.headerCard}>
                    <View style={styles.profileInfo}>
                        <View style={styles.avatarContainer}>
                            <Image 
                                source={{ uri: user?.profileImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User' }} 
                                style={styles.avatar} 
                            />
                        </View>
                        <View>
                            <Text style={styles.name}>{user?.name || 'User Name'}</Text>
                            <Text style={styles.bio}>{user?.bio || t('profile.noBio')}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.editButton}>
                        <Text style={styles.editButtonText}>{t('profile.editProfile')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Language Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('nav.settings')}</Text>
                    <View style={styles.langGrid}>
                        {langs.map((l) => (
                            <TouchableOpacity 
                                key={l.value}
                                style={[styles.langItem, lang === l.value && styles.langItemActive]}
                                onPress={() => setLang(l.value)}
                            >
                                <Text style={styles.langFlag}>{l.flag}</Text>
                                <Text style={[styles.langLabel, lang === l.value && styles.langLabelActive]}>{l.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: '#5B65F215' }]}>
                                <User size={20} color="#5B65F2" />
                            </View>
                            <Text style={styles.menuText}>{t('nav.manageAccount')}</Text>
                        </View>
                        <ChevronRight size={20} color="#ccc" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: '#FFB02015' }]}>
                                <Bell size={20} color="#FFB020" />
                            </View>
                            <Text style={styles.menuText}>{t('nav.notifications')}</Text>
                        </View>
                        <ChevronRight size={20} color="#ccc" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <LogOut size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>{t('auth.logout')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    headerCard: {
        backgroundColor: '#fff', padding: 20, alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
    },
    avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', overflow: 'hidden', backgroundColor: '#F3F4F6' },
    avatar: { width: '100%', height: '100%' },
    profileInfo: { alignItems: 'center', marginTop: 10 },
    name: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 10 },
    bio: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    editButton: { marginTop: 20, backgroundColor: '#5B65F2', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 15, width: '100%' },
    editButtonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
    section: { marginTop: 25, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 15 },
    langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    langItem: { 
        flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 12, borderRadius: 15, alignItems: 'center', flexDirection: 'row', gap: 10,
        borderWidth: 1, borderColor: '#F3F4F6'
    },
    langItemActive: { borderColor: '#5B65F2', backgroundColor: '#5B65F205' },
    langFlag: { fontSize: 20 },
    langLabel: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
    langLabelActive: { color: '#5B65F2' },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 18, marginBottom: 12 },
    menuLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    menuText: { fontSize: 16, fontWeight: '600', color: '#374151', marginLeft: 15 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 50, gap: 10 },
    logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
});
