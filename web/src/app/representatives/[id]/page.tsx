"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Mail, Phone, ExternalLink, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";

interface Representative {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    department: string;
    role: string;
    is_active: boolean;
}

interface Proposal {
    id: string;
    proposal_no: string;
    customer_name: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    usd_amount: number;
}

export default function RepresentativeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [rep, setRep] = useState<Representative | null>(null);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // 1. Get Representative Details
            const { data: repData, error: repError } = await supabase
                .from('representatives')
                .select('*')
                .eq('id', id)
                .single();

            if (repError) throw repError;
            setRep(repData);

            // 2. Get Proposals by Representative Name (String Match fallback as per current architecture)
            // TODO: Ideally optimize to use representative_id if available and consistent
            if (repData) {
                const { data: propData, error: propError } = await supabase
                    .from('proposals')
                    .select('*')
                    .eq('representative_name', repData.full_name)
                    .order('created_at', { ascending: false });

                if (propError) throw propError;
                setProposals(propData || []);
            }

        } catch (error) {
            console.error("Error fetching representative details:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Calculations ---
    const totalSales = proposals.reduce((sum, p) => sum + (p.usd_amount || 0), 0);
    const approvedProposals = proposals.filter(p => p.status === 'approved');
    const winRate = proposals.length > 0 ? Math.round((approvedProposals.length / proposals.length) * 100) : 0;

    // Monthly Stats (Last 6 months)
    const getMonthlyStats = () => {
        const stats: Record<string, number> = {};
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('tr-TR', { month: 'short' });
            months.push(key);
            stats[key] = 0;
        }

        proposals.forEach(p => {
            const date = new Date(p.created_at);
            const month = date.toLocaleString('tr-TR', { month: 'short' });
            if (stats[month] !== undefined) {
                stats[month] += (p.usd_amount || 0);
            }
        });

        return months.map(m => ({ name: m, value: stats[m] }));
    };

    const monthlyData = getMonthlyStats();
    const maxMonthlyValue = Math.max(...monthlyData.map(d => d.value), 1); // Avoid div by 0

    const formatCurrency = (val: number) => `$${val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-background-dark flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!rep) {
        return (
            <div className="p-8 text-center text-text-secondary">Temsilci bulunamadı.</div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-background-dark">
            <Header title="Temsilci Detayı" />

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {/* Top Actions */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-text-secondary hover:text-text-main transition-colors text-sm font-bold"
                >
                    <ArrowLeft size={16} className="mr-2" />
                    Temsilciler Listesine Dön
                </button>

                {/* Profile Header */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-black text-primary">
                            {rep.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-text-main dark:text-white">{rep.full_name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium text-text-secondary">{rep.role}</span>
                                <span className="w-1 h-1 rounded-full bg-border-dark opacity-50"></span>
                                <span className="text-sm font-bold text-primary">{rep.department}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {rep.phone && (
                            <a href={`tel:${rep.phone}`} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <Phone size={16} className="text-text-secondary" />
                                <span className="text-sm font-bold text-text-main dark:text-white">{rep.phone}</span>
                            </a>
                        )}
                        {rep.email && (
                            <a href={`mailto:${rep.email}`} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <Mail size={16} className="text-text-secondary" />
                                <span className="text-sm font-bold text-text-main dark:text-white">Email Gönder</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <CheckCircle size={64} className="text-primary" />
                        </div>
                        <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Başarı Oranı</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-text-main dark:text-white">%{winRate}</span>
                            <span className="text-sm text-text-secondary">Onaylanma</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${winRate}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark">
                        <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Toplam Satış (USD)</p>
                        <span className="text-3xl font-black text-primary">{formatCurrency(totalSales)}</span>
                        <p className="text-xs text-text-secondary mt-1">{approvedProposals.length} adet onaylı tekliften</p>
                    </div>

                    <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark">
                        <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Aktif Teklifler</p>
                        <span className="text-3xl font-black text-text-main dark:text-white">{proposals.length - approvedProposals.length}</span>
                        <p className="text-xs text-text-secondary mt-1">Takip edilen</p>
                    </div>
                </div>

                {/* Performance Chart & Recent List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Chart (Values) */}
                    <div className="lg:col-span-2 bg-white dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
                        <h3 className="text-lg font-bold text-text-main dark:text-white mb-6">Son 6 Ay Satış Performansı</h3>

                        <div className="flex items-end justify-between h-48 sm:h-64 gap-2 sm:gap-4">
                            {monthlyData.map((d, i) => {
                                const heightPercent = Math.max(10, Math.round((d.value / maxMonthlyValue) * 100));
                                return (
                                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                                        <div className="relative w-full flex justify-center items-end h-full">
                                            {/* Tooltip */}
                                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs py-1 px-2 rounded mb-2">
                                                {formatCurrency(d.value)}
                                            </div>
                                            {/* Bar */}
                                            <div
                                                className="w-full max-w-[40px] bg-primary/80 group-hover:bg-primary transition-all rounded-t-lg"
                                                style={{ height: `${heightPercent}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-bold text-text-secondary mt-3">{d.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Recent Proposals */}
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">Son Teklifler</h3>
                            <button className="text-xs text-primary font-bold hover:underline">Tümünü Gör</button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] lg:max-h-auto">
                            {proposals.slice(0, 5).map(p => (
                                <div key={p.id} className="p-3 rounded-lg border border-border-light dark:border-border-dark hover:border-primary/50 transition-colors">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-text-main dark:text-white truncate max-w-[120px]">{p.customer_name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                                            ${p.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }
                                        `}>
                                            {p.status === 'approved' ? 'Onaylandı' :
                                                p.status === 'rejected' ? 'Red' : 'Bekliyor'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-text-secondary">{new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
                                        <span className="text-sm font-black text-text-main dark:text-white">
                                            {p.amount?.toLocaleString()} {p.currency}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {proposals.length === 0 && (
                                <p className="text-sm text-text-secondary text-center py-4">Teklif bulunamadı.</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
