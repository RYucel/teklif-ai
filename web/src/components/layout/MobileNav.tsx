'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, FileText, MessageSquare, Bell } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Panel' },
    { href: '/upload', icon: Upload, label: 'Yükle' },
    { href: '/proposals', icon: FileText, label: 'Teklifler' },
    { href: '/chat', icon: MessageSquare, label: 'Asistan' },
    { href: '/notifications', icon: Bell, label: 'Bildirimler' },
];

export function MobileNav() {
    const pathname = usePathname();
    const { profile } = useAuth();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-700 z-50">
            <div className="flex justify-around items-center h-16 px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${isActive
                                ? 'text-primary'
                                : 'text-text-secondary hover:text-text-main'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                        </Link>
                    );
                })}
                })}
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-safe-area-inset-bottom bg-white dark:bg-background-dark" />
        </nav>
    );
}

function NotificationBadge({ isActive }: { isActive: boolean }) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    // Import supabase if not available in file scope, but here likely need to modify imports first.
    // Hack: Assuming imports will be added.

    // ... logic ...
    // Since I cannot modify imports and end of file efficiently in one go without multi_replace or careful replace.
    // I will use a simplified approach: Just render value if passed, but logic is complex.
    // Better strategy: Add logic in MobileNav component directly.
    return null;
}
