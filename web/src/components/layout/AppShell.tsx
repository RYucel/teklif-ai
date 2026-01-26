'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Loader2 } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
    const { loading, user } = useAuth();
    const pathname = usePathname();

    // Public paths that don't need the shell
    const publicPaths = ['/login', '/forgot-password'];
    const isPublicPath = publicPaths.includes(pathname);

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-text-secondary">Oturum kontrol ediliyor...</p>
            </div>
        );
    }

    // Public pages - no shell
    if (isPublicPath) {
        return <>{children}</>;
    }

    // Not logged in - children will be replaced by redirect
    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-text-secondary">Giriş sayfasına yönlendiriliyorsunuz...</p>
            </div>
        );
    }

    // Logged in - show app shell
    return (
        <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
                {children}
            </div>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden">
                <MobileNav />
            </div>
        </div>
    );
}
