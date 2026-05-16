import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Lock, User, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import net from '../network/client';
import { PacketSC } from '../../../src/user/network/packetList';
import { useDictionary } from '../utils/dictionary';
import { CONFIG } from '../config';

interface LoginProps {
    onLoginSuccess: (token: string, userData: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [connStatus, setConnStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
    const { t } = useDictionary();
    
    // Use ref to keep track of loading state for the listeners
    const loadingRef = useRef(false);
    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    useEffect(() => {
        const unsubStatus = net.onStatusChange(status => {
            console.log('[Login] Connection status changed:', status);
            setConnStatus(status);
        });

        // Listen for ACCEPT_LOGIN
        const unsubAccept = net.on(PacketSC.ACCEPT_LOGIN, (packet) => {
            console.log('[Login] ACCEPT_LOGIN received');
            
            try {
                const id           = String(packet.readInt());
                const name         = packet.readString();
                const profileImage = packet.readString();
                const token        = packet.readString();
                const nickname     = packet.readString();
                const phone        = packet.readString();
                const province     = packet.readString();
                const bio          = packet.readString();
                const coverImage   = packet.readString();
                const createdAt    = packet.readString();
                const lang         = packet.readString() || 'th';

                const userData = { 
                    id, name, profileImage, token, nickname, 
                    phone, province, bio, coverImage, createdAt, lang 
                };
                
                console.log('[Login] Login successful, calling onLoginSuccess');
                setLoading(false);
                // สำคัญ: เรียกใช้ props โดยตรง
                onLoginSuccess(token, userData);
            } catch (err) {
                console.error('[Login] Error parsing ACCEPT_LOGIN packet:', err);
                setLoading(false);
            }
        });

        // Listen for REJECT_LOGIN
        const unsubReject = net.on(PacketSC.REJECT_LOGIN, (packet) => {
            console.log('[Login] REJECT_LOGIN received');
            const reason = packet.readString();
            setLoading(false);
            Alert.alert('เข้าสู่ระบบไม่สำเร็จ', reason);
        });

        // Listen for Global Error
        const unsubError = net.on(PacketSC.ERROR, (packet) => {
            const msg = packet.readString();
            console.warn('[Login] Server Error:', msg);
            setLoading(false);
            Alert.alert('Error', msg);
        });

        return () => {
            unsubStatus();
            unsubAccept();
            unsubReject();
            unsubError();
        };
    }, []);

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert('Error', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            return;
        }

        if (connStatus !== 'connected') {
            console.log('[Login] Not connected, attempting to connect...');
            Alert.alert(
                'การเชื่อมต่อขัดข้อง', 
                `กำลังเชื่อมต่อกับเซิร์ฟเวอร์ (สถานะ: ${connStatus})\nกรุณารอสักครู่หรือตรวจสอบ API_URL ใน config.ts\n\nURL: ${CONFIG.WS_URL}`
            );
            net.connect(CONFIG.WS_URL);
            return;
        }

        setLoading(true);

        // Timeout fallback
        setTimeout(() => {
            if (loadingRef.current) {
                console.log('[Login] Login request timed out');
                setLoading(false);
                Alert.alert('Timeout', 'เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง');
            }
        }, 15000);

        console.log('[Login] Sending login packet for', username);
        net.login(username, password);
    };

    const handleSocialLogin = (type: 'LINE' | 'Google') => {
        Alert.alert(
            'Coming Soon',
            `Login with ${type} ในแอปมือถือจำเป็นต้องมีการตั้งค่าเฉพาะ\nกรุณาใช้ Username/Password ไปก่อนนะครับ`
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>KN</Text>
                        </View>
                        <Text style={styles.title}>{t('auth.login')}</Text>
                        <Text style={styles.subtitle}>{t('auth.welcome')}</Text>
                        
                        <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: connStatus === 'connected' ? '#10B981' : '#EF4444' }]} />
                            <Text style={styles.statusText}>
                                {connStatus === 'connected' ? 'Server Connected' : `Server ${connStatus}...`}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('auth.username')}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('auth.password')}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                {showPassword ? (
                                    <EyeOff size={20} color="#9CA3AF" />
                                ) : (
                                    <Eye size={20} color="#9CA3AF" />
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={[styles.loginButton, (loading || connStatus !== 'connected') && styles.disabledButton]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>{t('auth.login')}</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.orContainer}>
                            <View style={styles.line} />
                            <Text style={styles.orText}>{t('auth.orLoginWith')}</Text>
                            <View style={styles.line} />
                        </View>

                        <View style={styles.socialContainer}>
                            <TouchableOpacity 
                                style={[styles.socialButton, { backgroundColor: '#06C755' }]}
                                onPress={() => handleSocialLogin('LINE')}
                            >
                                <Svg viewBox="0 0 24 24" style={styles.socialIcon}>
                                    <Path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.052.303-.251 1.184 1.081.644 1.333-.541 7.199-4.24 9.823-7.262 1.861-1.99 3.135-4.043 3.135-5.704z" fill="white" />
                                    <SvgText x="12" y="13" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#05b34c">LINE</SvgText>
                                </Svg>
                                <Text style={styles.socialButtonText}>LINE</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.socialButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB' }]}
                                onPress={() => handleSocialLogin('Google')}
                            >
                                <Svg viewBox="0 0 24 24" style={styles.socialIcon}>
                                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                                </Svg>
                                <Text style={[styles.socialButtonText, { color: '#374151' }]}>Google</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
                            <TouchableOpacity>
                                <Text style={styles.registerText}>{t('auth.createAccount')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 30, paddingBottom: 30, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 40 },
    logoContainer: {
        width: 80, height: 80, backgroundColor: '#5B65F2', borderRadius: 24,
        justifyContent: 'center', alignItems: 'center', marginBottom: 20,
        shadowColor: '#5B65F2', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10,
    },
    logoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
    title: { fontSize: 28, fontWeight: '800', color: '#111827' },
    subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 15 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
    form: { gap: 20 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
        borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 15, height: 56,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#111827' },
    loginButton: {
        backgroundColor: '#5B65F2', height: 56, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center', marginTop: 10,
    },
    disabledButton: { opacity: 0.6 },
    loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    orContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    line: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
    orText: { marginHorizontal: 10, color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
    socialContainer: { flexDirection: 'row', gap: 12 },
    socialButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    socialIcon: { width: 20, height: 20 },
    socialButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: '#6B7280', fontSize: 14 },
    registerText: { color: '#5B65F2', fontSize: 14, fontWeight: '700' },
});
