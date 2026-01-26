'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import { Bell, CheckCircle, Info, Clock } from 'lucide-react';
import { Header } from '@/components/layout/Header';

interface Notification {
    id: string;
    type: 'reminder' | 'status' | 'system';
    title: string;
    message: string;
    created_at: string;
    is_read: boolean;
    user_id: string;
}

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        console.log("Notifications: Initializing for user", user.id);
        fetchNotifications();

        // Realtime Subscription
        const channel = supabase
            .channel('web-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                console.log("New Notification Received:", payload);
                const newNotification = payload.new as Notification;
                setNotifications(prev => [newNotification, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchNotifications = async () => {
        try {
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data as Notification[]);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) return 'Yeni';
        if (hours < 24) return `${hours} saat önce`;
        return date.toLocaleDateString('tr-TR');
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'reminder': return <Clock size={20} className="text-yellow-600" />;
            case 'status': return <CheckCircle size={20} className="text-green-600" />;
            default: return <Info size={20} className="text-blue-600" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'reminder': return 'bg-yellow-100';
            case 'status': return 'bg-green-100';
            default: return 'bg-blue-100';
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-background-dark pb-20">
            <Header title="Bildirimler" />

            <main className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Bell size={48} className="mb-4 opacity-20" />
                        <p>Henüz bildiriminiz yok.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4 ${!notification.is_read ? 'border-l-4 border-l-primary' : ''}`}
                            >
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getBgColor(notification.type)}`}>
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-semibold text-text-main dark:text-gray-100 text-sm">{notification.title}</h3>
                                        <span className="text-xs text-text-secondary">{formatDate(notification.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-text-secondary leading-relaxed">{notification.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
