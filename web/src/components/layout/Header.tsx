"use client";

import Link from "next/link";
import { Search, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function NotificationBadge() {
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
            .channel('header-notifications')
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

    if (unreadCount === 0) return null;

    return (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-background-dark">
            {unreadCount > 9 ? '9+' : unreadCount}
        </span>
    );
}

export function Header({ title }: { title: string }) {
    const { profile, signOut } = useAuth();

    return (
        <header className="flex items-center justify-between border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 md:px-8 py-3 md:py-4 sticky top-0 z-10">
            {/* Left side - Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h2 className="text-text-main dark:text-white text-lg md:text-xl font-bold tracking-tight truncate">
                    {title}
                </h2>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2 md:gap-4">
                {/* Search - desktop only */}
                <div className="relative hidden lg:block w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input
                        className="w-full h-9 pl-9 pr-4 rounded-lg border-none bg-background-light dark:bg-background-dark text-text-main dark:text-white placeholder:text-text-secondary text-sm focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Ara..."
                    />
                </div>

                {/* Mobile search button */}
                <button className="p-2.5 rounded-lg bg-background-light dark:bg-background-dark text-text-main dark:text-white hover:bg-gray-200 transition-colors lg:hidden">
                    <Search size={20} />
                </button>

                {/* Notifications */}
                <Link
                    href="/notifications"
                    className="p-2.5 rounded-lg bg-background-light dark:bg-background-dark text-text-main dark:text-white hover:bg-gray-200 transition-colors relative"
                >
                    <Bell size={20} />
                    <NotificationBadge />
                </Link>

                {/* User avatar - mobile only (desktop shows in sidebar) */}
                <div className="relative md:hidden group">
                    <button className="w-9 h-9 rounded-full border-2 border-primary bg-primary/20 overflow-hidden flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                            {profile?.full_name?.charAt(0) || 'U'}
                        </span>
                    </button>

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-12 w-48 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark p-2 hidden group-focus-within:block">
                        <div className="px-3 py-2 border-b border-border-light dark:border-border-dark mb-2">
                            <p className="text-sm font-bold text-text-main dark:text-white truncate">{profile?.full_name}</p>
                            <p className="text-xs text-text-secondary truncate">{profile?.email}</p>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <LogOut size={16} />
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
