'use client';

import { Clock, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';

interface FollowUpBadgeProps {
    nextFollowUpDate: string | null;
    missedCount: number;
    onClick?: () => void;
}

export function FollowUpBadge({ nextFollowUpDate, missedCount, onClick }: FollowUpBadgeProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getStatus = () => {
        if (!nextFollowUpDate) {
            if (missedCount > 0) {
                return {
                    type: 'warning',
                    label: `${missedCount} kaçırıldı`,
                    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    icon: AlertTriangle
                };
            }
            return {
                type: 'none',
                label: 'Planla',
                color: 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30 font-bold',
                icon: Calendar
            };
        }

        const followUpDate = new Date(nextFollowUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                type: 'overdue',
                label: `${Math.abs(diffDays)} gün gecikti`,
                color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
                icon: AlertTriangle
            };
        } else if (diffDays === 0) {
            return {
                type: 'today',
                label: 'Bugün',
                color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                icon: Clock
            };
        } else if (diffDays <= 3) {
            return {
                type: 'soon',
                label: `${diffDays} gün`,
                color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                icon: Clock
            };
        } else {
            const formattedDate = new Date(nextFollowUpDate).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short'
            });
            return {
                type: 'scheduled',
                label: formattedDate,
                color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                icon: CheckCircle
            };
        }
    };

    const status = getStatus();
    const Icon = status.icon;

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-transform hover:scale-105 ${status.color}`}
        >
            <Icon className="w-3.5 h-3.5" />
            {status.label}
            {missedCount > 0 && status.type !== 'warning' && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                    {missedCount}
                </span>
            )}
        </button>
    );
}
