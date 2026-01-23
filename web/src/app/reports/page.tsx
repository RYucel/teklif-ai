"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Download, Share2, Calendar, Users, ChevronDown, Award, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Representative {
    id: string;
    full_name: string;
    role: string;
    department: string;
}

interface Proposal {
    id: string;
    representative_name: string;
    status: string;
    amount: number;
    currency: string;
}

interface RepStats {
    id: string;
    name: string;
    role: string;
    totalProposals: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    totalAmount: number;
    approvedAmount: number;
    conversionRate: number;
    approvalRate: number;
    pendingRate: number;
    rejectedRate: number;
}

export default function ReportsPage() {
    const [stats, setStats] = useState<RepStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);

        // Fetch reps and proposals
        const { data: reps } = await supabase.from('representatives').select('*').eq('is_active', true);
        const { data: proposals } = await supabase.from('proposals').select('representative_name, status, amount, currency');

        if (!reps || !proposals) {
            setLoading(false);
            return;
        }

        // Calculate stats per representative
        const calculatedStats: RepStats[] = reps.map(rep => {
            const repProposals = proposals.filter(p =>
                p.representative_name?.toLowerCase() === rep.full_name?.toLowerCase()
            );

            const total = repProposals.length;
            const approved = repProposals.filter(p => p.status === 'approved');
            const pending = repProposals.filter(p => !['approved', 'rejected', 'cancelled'].includes(p.status));
            const rejected = repProposals.filter(p => ['rejected', 'cancelled'].includes(p.status));

            const approvedAmount = approved.reduce((acc, p) => acc + (p.amount || 0), 0);
            const totalAmount = repProposals.reduce((acc, p) => acc + (p.amount || 0), 0);

            const conversionRate = total > 0 ? (approved.length / total) * 100 : 0;

            return {
                id: rep.id,
                name: rep.full_name,
                role: rep.role || 'Temsilci',
                totalProposals: total,
                approvedCount: approved.length,
                pendingCount: pending.length,
                rejectedCount: rejected.length,
                totalAmount,
                approvedAmount,
                conversionRate,
                approvalRate: Math.round(conversionRate),
                pendingRate: total > 0 ? Math.round((pending.length / total) * 100) : 0,
                rejectedRate: total > 0 ? Math.round((rejected.length / total) * 100) : 0,
            };
        });

        // Sort by conversion rate for top performers
        calculatedStats.sort((a, b) => b.approvedAmount - a.approvedAmount); // Sort by revenue/approved amount mainly

        setStats(calculatedStats);
        setLoading(false);
    };

    const topPerformers = stats.slice(0, 3);

    const formatCurrency = (amount: number) => {
        return `$${amount.toLocaleString('tr-TR')}`;
    };

    if (loading) {
        return (
            <>
                <Header title="Raporlar" />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={40} />
                </main>
            </>
        );
    }

    return (
        <>
            <Header title="Temsilci Performans Raporları" />
            <main className="flex-1 p-8 space-y-8 overflow-y-auto">
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-text-main dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">Performans Analizi</h1>
                        <p className="text-text-secondary text-base font-normal leading-normal">Satış ekibi dönüşüm ve yanıt metriklerine dair AI destekli analizler</p>
                    </div>
                </div>

                {/* Top Performers Section */}
                {topPerformers.length > 0 && (
                    <section className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <Award className="text-primary" size={24} />
                            <h3 className="text-xl font-bold dark:text-white">En Yüksek Ciro Yapan 3 Temsilci</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            {/* Re-order for visual hierarchy: 2nd, 1st, 3rd */}
                            {topPerformers.length >= 2 && (
                                <TopPerformerCard
                                    name={topPerformers[1].name}
                                    rate={formatCurrency(topPerformers[1].approvedAmount)}
                                    subLabel="Onaylanan Tutar"
                                    rank={2}
                                    width={`${topPerformers[1].approvalRate}%`}
                                />
                            )}

                            <TopPerformerCard
                                name={topPerformers[0].name}
                                rate={formatCurrency(topPerformers[0].approvedAmount)}
                                subLabel="Onaylanan Tutar"
                                rank={1}
                                isWinner
                                width={`${topPerformers[0].approvalRate}%`}
                            />

                            {topPerformers.length >= 3 && (
                                <TopPerformerCard
                                    name={topPerformers[2].name}
                                    rate={formatCurrency(topPerformers[2].approvedAmount)}
                                    subLabel="Onaylanan Tutar"
                                    rank={3}
                                    width={`${topPerformers[2].approvalRate}%`}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* All Performance Cards */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {stats.map(stat => (
                        <PerformanceCard
                            key={stat.id}
                            name={stat.name}
                            role={stat.role}
                            proposals={stat.totalProposals}
                            amount={formatCurrency(stat.approvedAmount)}
                            approvalRate={stat.approvalRate}
                            pendingRate={stat.pendingRate}
                            rejectedRate={stat.rejectedRate}
                            responseRate={`${stat.approvalRate}%`} // Using conversion rate as proxy for simplistic view
                        />
                    ))}
                    {stats.length === 0 && (
                        <p className="text-center text-text-secondary col-span-2 py-12">Henüz veri yok.</p>
                    )}
                </div>
            </main>
        </>
    );
}

function TopPerformerCard({ name, rate, subLabel, rank, isWinner, width }: any) {
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

    return (
        <div className={`bg-white dark:bg-surface-dark p-6 rounded-xl border ${isWinner ? 'border-2 border-primary/30 shadow-xl shadow-primary/5 p-8 relative overflow-hidden' : 'border border-border-light dark:border-border-dark relative overflow-hidden flex flex-col items-center text-center'}`}>
            <div className="absolute top-0 right-0 p-3">
                {isWinner ? (
                    <Award className="text-primary" size={32} />
                ) : (
                    <div className="bg-background-light dark:bg-white/10 rounded-full px-2 py-1 text-[10px] font-bold text-text-secondary">SIRA {rank}</div>
                )}
            </div>
            <div className={`w-20 h-20 bg-primary/20 flex items-center justify-center rounded-full mb-4 mx-auto ${isWinner ? 'w-24 h-24 ring-4 ring-primary' : 'ring-4 ring-background-light dark:ring-white/5'}`}>
                <span className={`font-black ${isWinner ? 'text-3xl' : 'text-2xl'} text-primary`}>{initials}</span>
            </div>
            <h4 className={`font-bold ${isWinner ? 'text-xl' : 'text-lg'} dark:text-white text-center`}>{name}</h4>
            <p className={`text-primary font-black ${isWinner ? 'text-3xl' : 'text-2xl'} text-center`}>{rate}</p>
            <p className="text-text-secondary text-xs uppercase font-bold mt-1 text-center">{subLabel}</p>
            <div className="w-full h-2 bg-background-light dark:bg-white/10 mt-6 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width }}></div>
            </div>
        </div>
    )
}

function PerformanceCard({ name, role, proposals, amount, approvalRate, pendingRate, rejectedRate, responseRate }: any) {
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {initials}
                    </div>
                    <div>
                        <h5 className="font-bold text-lg dark:text-white">{name}</h5>
                        <p className="text-xs text-text-secondary font-medium">{role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded text-primary text-[10px] font-black uppercase">
                    <Zap size={12} fill="currentColor" /> AI İzleme
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-background-light dark:bg-white/5 p-4 rounded-lg">
                    <p className="text-xs text-text-secondary font-bold uppercase mb-1">Toplam Teklif</p>
                    <p className="text-2xl font-black dark:text-white">{proposals}</p>
                </div>
                <div className="bg-background-light dark:bg-white/5 p-4 rounded-lg">
                    <p className="text-xs text-text-secondary font-bold uppercase mb-1">Onaylanan Tutar</p>
                    <p className="text-2xl font-black dark:text-white">{amount}</p>
                </div>
            </div>

            <div className="flex gap-6 items-center border-t border-border-light dark:border-border-dark pt-6">
                <div className="flex-1">
                    <p className="text-xs text-text-secondary font-bold uppercase mb-4">Durum Dağılımı</p>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full" style={{ background: `conic-gradient(#13ec5b 0% ${approvalRate}%, #3b82f6 ${approvalRate}% ${approvalRate + pendingRate}%, #f87171 ${approvalRate + pendingRate}% 100%)` }}></div>
                        <div className="flex flex-col gap-1">
                            <LegendDot color="bg-primary" label={`${approvalRate}% Onaylanan`} />
                            <LegendDot color="bg-blue-500" label={`${pendingRate}% Bekleyen`} />
                            <LegendDot color="bg-red-400" label={`${rejectedRate}% Diğer`} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center border-l border-border-light dark:border-border-dark pl-6">
                    <p className="text-xs text-text-secondary font-bold uppercase mb-4 w-full">Dönüşüm</p>
                    <div className="relative flex items-center justify-center w-[100px] h-[50px] mb-2">
                        <p className="text-3xl font-black text-primary">{responseRate}</p>
                    </div>
                    <p className="text-[10px] text-text-secondary font-bold">Başarı Oranı</p>
                </div>
            </div>
        </div>
    )
}

function LegendDot({ color, label }: any) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`}></div>
            <span className="text-[10px] font-bold dark:text-white">{label}</span>
        </div>
    )
}
