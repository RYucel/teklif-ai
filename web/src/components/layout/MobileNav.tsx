'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, FileText, MessageSquare, Bell } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Panel' },
    { href: '/upload', icon: Upload, label: 'Yükle' },
    { href: '/proposals', icon: FileText, label: 'Teklifler' },
    { href: '/chat', icon: MessageSquare, label: 'Asistan' },
    { href: '/notifications', icon: Bell, label: 'Bildirimler' },
];

export function MobileNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const fetchUnread = async () => {
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            setUnreadCount(count || 0);
        };

        fetchUnread();

        const channel = supabase
            .channel('mobile-nav-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-700 z-50">
            <div className="flex justify-around items-center h-16 px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    const isNotification = item.href === '/notifications';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors relative ${isActive
                                ? 'text-primary'
                                : 'text-text-secondary hover:text-text-main'
                                }`}
                        >
                            <div className="relative">
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                                {isNotification && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] h-[16px] flex items-center justify-center border-2 border-white dark:border-background-dark">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-safe-area-inset-bottom bg-white dark:bg-background-dark" />
        </nav>
    );
}
