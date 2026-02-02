"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Upload,
    Users,
    FileText,
    BarChart3,
    Bot,
    PlusCircle,
    LogOut,
    User
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export function Sidebar() {
    const pathname = usePathname();
    const { profile, signOut, isAdmin } = useAuth();

    return (
        <aside className="w-64 border-r border-border-light dark:border-border-dark bg-white dark:bg-surface-dark flex flex-col h-screen sticky top-0">
            <div className="p-6 flex flex-col h-full justify-between">
                <div className="flex flex-col gap-8">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-lg">
                            <BarChart3 className="text-background-dark" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-text-main dark:text-white text-base font-bold leading-none">Teklif Yöneticisi</h1>
                            <p className="text-text-secondary text-xs font-normal">
                                {isAdmin ? 'Yönetici' : 'Temsilci'}
                            </p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2">
                        <NavItem href="/" icon={<LayoutDashboard size={20} />} label="Panel" active={pathname === "/"} />
                        {isAdmin && (
                            <NavItem href="/upload" icon={<Upload size={20} />} label="Teklif Yükle" active={pathname === "/upload"} />
                        )}
                        {isAdmin && (
                            <NavItem href="/representatives" icon={<Users size={20} />} label="Temsilciler" active={pathname === "/representatives"} />
                        )}
                        <NavItem href="/proposals" icon={<FileText size={20} />} label="Teklifler" active={pathname === "/proposals"} />
                        {isAdmin && (
                            <NavItem href="/reports" icon={<BarChart3 size={20} />} label="Raporlar" active={pathname === "/reports"} />
                        )}
                        <NavItem href="/chat" icon={<Bot size={20} />} label="Yapay Zeka Chatbot" active={pathname === "/chat"} />
                    </nav>
                </div>

                <div className="flex flex-col gap-4">
                    {/* User Info */}
                    <div className="flex items-center gap-3 p-3 bg-background-light dark:bg-background-dark rounded-lg">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                            <User size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-main dark:text-white truncate">
                                {profile?.full_name || profile?.email || 'Kullanıcı'}
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                                {profile?.email}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {/* Action Buttons */}
                    {
                        isAdmin && (
                            <Link href="/upload" className="flex w-full cursor-pointer items-center justify-center rounded-lg h-11 px-4 bg-primary text-text-main text-sm font-bold tracking-tight hover:opacity-90 transition-opacity">
                                <PlusCircle className="mr-2" size={20} />
                                Yeni Teklif
                            </Link>
                        )
                    }

                    {/* Logout Button */}
                    <button
                        onClick={signOut}
                        className="flex w-full cursor-pointer items-center justify-center rounded-lg h-10 px-4 border border-border-light dark:border-border-dark text-text-secondary text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                    >
                        <LogOut className="mr-2" size={18} />
                        Çıkış Yap
                    </button>
                </div>
            </div>
        </aside>
    );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active
                ? "bg-primary/10 text-text-main dark:text-primary font-semibold"
                : "text-text-secondary hover:bg-background-light dark:hover:bg-background-dark font-medium"
                }`}
        >
            {icon}
            <span className="text-sm">{label}</span>
        </Link>
    );
}
