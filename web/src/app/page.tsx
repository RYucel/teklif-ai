"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { TrendingUp, TrendingDown, Upload, CheckCircle, Bell, FileText, Loader2 } from "lucide-react";

interface DashboardStats {
  totalProposals: number;
  approvedAmount: number;
  draftCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  conversionRate: number;
  currencyBreakdown: Record<string, number>;
}

interface RecentProposal {
  id: string;
  proposal_no: string;
  customer_name: string;
  representative_name: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  next_follow_up_date?: string;
  representative_id?: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProposals, setRecentProposals] = useState<RecentProposal[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<RecentProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [user, authLoading]);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      // 1. Get Stats via RPC
      const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats');

      if (statsError) throw statsError;

      const conversionRate = statsData.total_proposals > 0
        ? ((statsData.approved_count / statsData.total_proposals) * 100)
        : 0;

      // Calculate total amount in USD (sum of all currencies for now, or just primary)
      // Note: The RPC returns currency breakdown. For now, we sum them simply or pick USD.
      // Ideally we should normalize, but for this quick view we sum values.
      const breakdown = statsData.currency_breakdown || {};
      const totalAmount = Object.values(breakdown).reduce((a: any, b: any) => a + (Number(b) || 0), 0) as number;

      setStats({
        totalProposals: statsData.total_proposals,
        approvedAmount: totalAmount, // This might need currency handling later
        draftCount: statsData.draft_count,
        approvedCount: statsData.approved_count,
        pendingCount: statsData.pending_count,
        rejectedCount: statsData.rejected_count,
        conversionRate: conversionRate,
        currencyBreakdown: breakdown
      });

      // 2. Get Recent Proposals (still fetch, but only 5)
      const { data: recent, error: recentError } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      setRecentProposals(recent || []);

      // 3. Get Upcoming Follow-ups (Admins only or relevant logic)
      const { data: followUps, error: followUpError } = await supabase
        .from('proposals')
        .select('*')
        .not('next_follow_up_date', 'is', null)
        .gte('next_follow_up_date', new Date().toISOString().split('T')[0]) // Today or future
        .order('next_follow_up_date', { ascending: true })
        .limit(5);

      if (followUpError) throw followUpError;
      setUpcomingFollowUps(followUps || []);

    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺', GBP: '£' };
    return `${symbols[currency] || '$'}${amount.toLocaleString('tr-TR')}`;
  };

  const handleInstantReminder = async (proposal: RecentProposal) => {
    if (!proposal.representative_id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: proposal.representative_id,
          type: 'reminder',
          title: '📌 Acil Takip Hatırlatması',
          message: `Yönetici, ${proposal.proposal_no} nolu ${proposal.customer_name} teklifi için ACİL takip notu girmenizi/güncellemenizi rica ediyor.`,
          proposal_id: proposal.id,
          is_read: false
        });

      if (error) throw error;

      // 3. Direct Fetch to Edge Function (Debug Mode)
      // We skip supabase.functions.invoke to debug potential client issues
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Oturum token'ı bulunamadı. Lütfen tekrar giriş yapın.");

      const response = await fetch('https://xjmgwfcveqvumykjvrtj.supabase.co/functions/v1/send-push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: proposal.representative_id,
          title: '📌 Acil Takip Hatırlatması',
          body: `Yönetici, ${proposal.proposal_no} nolu ${proposal.customer_name} teklifi için ACİL takip notu girmenizi/güncellemenizi rica ediyor.`,
          data: { proposalId: proposal.id }
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Sunucu Hatası (${response.status}): ${responseText}`);
      }

      console.log("Push result:", responseText);
      alert("✅ Başarılı! Sunucu Yanıtı: " + responseText);

    } catch (err: any) {
      console.error("Reminder error:", err);
      alert("❌ HATA: " + err.message);
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-600' },
    approved: { label: 'Onaylandı', color: 'bg-green-100 text-green-600' },
    revised: { label: 'Revize', color: 'bg-yellow-100 text-yellow-600' },
    rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-600' },
    cancelled: { label: 'İptal', color: 'bg-red-100 text-red-600' },
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return `${diffDays} gün önce`;
  };

  if (loading) {
    return (
      <>
        <Header title="Yönetici Paneli" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={40} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Yönetici Paneli v1.4" />
      <main className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Toplam Teklif"
            value={stats?.totalProposals.toString() || "0"}
            trend={`${stats?.draftCount || 0} taslak`}
            trendLabel=""
            positive
          />
          <StatCard
            title="Toplam Tutar"
            value={formatCurrency(Object.values(stats?.currencyBreakdown || {}).reduce((a, b) => a + b, 0))}
            trend={`${Object.keys(stats?.currencyBreakdown || {}).length} para birimi`}
            trendLabel=""
            positive
          />
          <StatCard
            title="Onaylanan"
            value={stats?.approvedCount.toString() || "0"}
            trend={`${stats?.pendingCount || 0} beklemede`}
            trendLabel=""
            positive
          />
          <StatCard
            title="Dönüşüm Oranı"
            value={`${stats?.conversionRate.toFixed(1) || 0}%`}
            trend="hedef: 70%"
            trendLabel=""
            positive={(stats?.conversionRate || 0) >= 50}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
          <div className="xl:col-span-2 space-y-4 md:space-y-8">
            {/* Status Distribution */}
            <div className="flex flex-col gap-3 md:gap-4 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 md:p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-main dark:text-white text-lg font-bold">Duruma Göre Teklifler</h3>
                  <p className="text-text-secondary text-sm">Gerçek zamanlı durum dağılımı</p>
                </div>
                <span className="px-2 py-1 rounded bg-background-light dark:bg-background-dark text-xs font-semibold text-text-main">Güncel</span>
              </div>

              <div className="flex flex-wrap items-center justify-around gap-8 py-4">
                <div className="relative w-48 h-48">
                  {/* Donut chart using CSS */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    {stats && stats.totalProposals > 0 && (
                      <>
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#13ec5b" strokeWidth="12"
                          strokeDasharray={`${(stats.approvedCount / stats.totalProposals) * 251.2} 251.2`}
                          strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="12"
                          strokeDasharray={`${(stats.pendingCount / stats.totalProposals) * 251.2} 251.2`}
                          strokeDashoffset={`${-(stats.approvedCount / stats.totalProposals) * 251.2}`}
                          strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#9ca3af" strokeWidth="12"
                          strokeDasharray={`${(stats.draftCount / stats.totalProposals) * 251.2} 251.2`}
                          strokeDashoffset={`${-((stats.approvedCount + stats.pendingCount) / stats.totalProposals) * 251.2}`}
                          strokeLinecap="round" />
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-text-main dark:text-white">{stats?.totalProposals || 0}</span>
                    <span className="text-xs text-text-secondary">Toplam</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <LegendItem color="bg-primary" label={`Onaylandı (${stats?.approvedCount || 0})`} />
                  <LegendItem color="bg-blue-500" label={`Beklemede (${stats?.pendingCount || 0})`} />
                  <LegendItem color="bg-gray-400" label={`Taslak (${stats?.draftCount || 0})`} />
                  <LegendItem color="bg-red-400" label={`Reddedildi (${stats?.rejectedCount || 0})`} />
                </div>
              </div>
            </div>

            {/* Currency Breakdown */}
            <div className="flex flex-col gap-6 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-main dark:text-white text-lg font-bold">Para Birimine Göre Tutar</h3>
                  <p className="text-text-secondary text-sm">Teklif tutarlarının dağılımı</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats?.currencyBreakdown || {}).map(([currency, amount]) => (
                  <div key={currency} className="bg-background-light dark:bg-background-dark rounded-lg p-4 text-center">
                    <p className="text-2xl font-black text-primary">{formatCurrency(amount, currency)}</p>
                    <p className="text-xs text-text-secondary font-bold uppercase mt-1">{currency}</p>
                  </div>
                ))}
                {Object.keys(stats?.currencyBreakdown || {}).length === 0 && (
                  <p className="text-text-secondary col-span-4 text-center py-8">Henüz teklif yok</p>
                )}
              </div>
            </div>
          </div>


          {/* Right Column: Recent & Follow Ups */}
          <div className="flex flex-col gap-6">

            {/* Upcoming Follow-ups Section */}
            <div className="flex flex-col rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-sm h-fit">
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                <div>
                  <h3 className="text-text-main dark:text-white text-lg font-bold">Yaklaşan Takipler</h3>
                  <p className="text-text-secondary text-sm">Takip tarihi gelen teklifler</p>
                </div>
                <Bell size={20} className="text-primary" />
              </div>
              <div className="p-4 flex flex-col divide-y divide-border-light dark:divide-border-dark">
                {upcomingFollowUps.map(proposal => (
                  <div key={proposal.id} className="py-4 flex gap-4 items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {new Date(proposal.next_follow_up_date!).toLocaleDateString('tr-TR')}
                        </span>
                        <p className="text-sm font-bold text-text-main dark:text-white truncate">{proposal.customer_name}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-text-secondary">Teklif: #{proposal.proposal_no}</p>
                        <p className="text-xs text-text-secondary">Temsilci: {proposal.representative_name || 'Atanmamış'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleInstantReminder(proposal)}
                      className="px-3 py-1.5 bg-background-light dark:bg-white/10 hover:bg-primary hover:text-white text-text-secondary text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                      title="Anında Hatırlat">
                      <Bell size={14} /> Hatırlat
                    </button>
                  </div>
                ))}
                {upcomingFollowUps.length === 0 && (
                  <p className="text-text-secondary text-center py-6">Planlanmış takip yok</p>
                )}
              </div>
            </div>

            {/* Recent Proposals */}
            <div className="flex flex-col rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-sm h-fit">
              <div className="p-6 border-b border-border-light dark:border-border-dark">
                <h3 className="text-text-main dark:text-white text-lg font-bold">Son Teklifler</h3>
                <p className="text-text-secondary text-sm">En son eklenen teklifler</p>
              </div>
              <div className="p-4 flex flex-col divide-y divide-border-light dark:divide-border-dark">
                {recentProposals.map(proposal => (
                  <div key={proposal.id} className="py-4 flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-primary">{proposal.proposal_no}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${statusLabels[proposal.status]?.color || 'bg-gray-100'}`}>
                          {statusLabels[proposal.status]?.label || proposal.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-main dark:text-white font-medium truncate">{proposal.customer_name}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{getTimeAgo(proposal.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-main dark:text-white">{formatCurrency(proposal.amount, proposal.currency)}</p>
                    </div>
                  </div>
                ))}
                {recentProposals.length === 0 && (
                  <p className="text-text-secondary text-center py-8">Henüz teklif yok</p>
                )}
              </div>
              <a href="/proposals" className="m-6 mt-2 p-3 text-sm font-bold border border-border-light dark:border-border-dark rounded-lg hover:bg-background-light dark:hover:bg-background-dark transition-colors text-text-main text-center block">
                Tüm Teklifleri Görüntüle
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({ title, value, trend, trendLabel, positive }: any) {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2 rounded-xl p-4 md:p-6 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
      <p className="text-text-secondary text-xs md:text-sm font-medium leading-normal">{title}</p>
      <p className="text-text-main dark:text-white tracking-tight text-2xl md:text-3xl font-bold leading-tight">{value}</p>
      <div className="flex items-center gap-1">
        {positive ? <TrendingUp size={14} className="text-primary font-bold" /> : <TrendingDown size={14} className="text-red-500 font-bold" />}
        <p className={`${positive ? 'text-primary' : 'text-red-500'} text-xs md:text-sm font-semibold`}>{trend}</p>
        {trendLabel && <span className="text-text-secondary text-xs ml-1">{trendLabel}</span>}
      </div>
    </div>
  )
}

function LegendItem({ color, label }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <p className="text-sm font-medium text-text-main dark:text-white">{label}</p>
    </div>
  )
}
