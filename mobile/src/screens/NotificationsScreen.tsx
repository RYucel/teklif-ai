import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

interface Notification {
    id: string;
    type: 'reminder' | 'status' | 'system';
    title: string;
    message: string;
    time: string;
    created_at: string;
    is_read: boolean;
}

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();

        // Subscription for new notifications
        const subscription = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}` // Dynamic filter tricky in useEffect, simplifying
            }, (payload) => {
                const newNotification = payload.new as Notification;
                // Add new notification to top
                setNotifications(prev => [newNotification, ...prev]);
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data as Notification[]);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const FormatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) return 'Yeni';
        if (hours < 24) return `${hours} saat önce`;
        return date.toLocaleDateString('tr-TR');
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'reminder': return '⏰';
            case 'status': return '✅';
            default: return 'ℹ️';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Bildirimler</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#13ec5b" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={[styles.notificationCard, !item.is_read && styles.unread]}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.icon}>{getIcon(item.type)}</Text>
                            </View>
                            <View style={styles.content}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.notificationTitle}>{item.title}</Text>
                                    <Text style={styles.time}>{FormatDate(item.created_at)}</Text>
                                </View>
                                <Text style={styles.message}>{item.message}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f6f8f6',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#dbe6df',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111813',
    },
    listContent: {
        padding: 16,
    },
    notificationCard: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbe6df',
        flexDirection: 'row',
        gap: 12,
    },
    unread: {
        borderLeftWidth: 4,
        borderLeftColor: '#13ec5b',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f6f8f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 18,
    },
    content: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    notificationTitle: {
        fontWeight: 'bold',
        color: '#111813',
        fontSize: 14,
    },
    time: {
        fontSize: 10,
        color: '#61896f',
    },
    message: {
        fontSize: 13,
        color: '#61896f',
        lineHeight: 18,
    },
    emptyText: {
        textAlign: 'center',
        color: '#61896f',
        marginTop: 40,
    },
});
