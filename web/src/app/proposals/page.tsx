"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { FollowUpModal } from "@/components/proposals/FollowUpModal";
import { FollowUpBadge } from "@/components/proposals/FollowUpBadge";
import { FileText, Search, Filter, Eye, Edit, Trash2, Clock, CheckCircle, XCircle, Send, AlertCircle } from "lucide-react";

interface Proposal {
    id: string;
    proposal_no: string;
    customer_name: string;
    representative_name: string;
    representative_id: string;
    department_code: string;
    amount: number;
    currency: string;
    status: string;
    work_description: string;
    offer_date: string;
    pdf_url?: string;
    created_at: string;
    next_follow_up_date: string | null;
    follow_up_count: number;
    missed_follow_up_count: number;
    last_contact_date: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: "Taslak", color: "bg-gray-100 text-gray-700", icon: <Clock size={14} /> },
    sent: { label: "Gönderildi", color: "bg-blue-100 text-blue-700", icon: <Send size={14} /> },
    approved: { label: "Onaylandı", color: "bg-green-100 text-green-700", icon: <CheckCircle size={14} /> },
    revised: { label: "Revize", color: "bg-yellow-100 text-yellow-700", icon: <AlertCircle size={14} /> },
    cancelled: { label: "İptal", color: "bg-red-100 text-red-700", icon: <XCircle size={14} /> },
    rejected: { label: "Reddedildi", color: "bg-red-100 text-red-700", icon: <XCircle size={14} /> },
};

const deptLabels: Record<string, string> = {
    "01": "Havuz",
    "02": "Solar",
    "03": "Klima",
    "04": "Diğer",
};

export default function ProposalsPage() {
    const { user } = useAuth();
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
    const [followUpProposal, setFollowUpProposal] = useState<Proposal | null>(null);

    useEffect(() => {
        fetchProposals();
    }, []);

    const fetchProposals = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching proposals:", error);
        } else {
            setProposals(data || []);
        }
        setLoading(false);
    };

    const filteredProposals = proposals.filter(p =>
        p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.proposal_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount: number, currency: string) => {
        const symbols: Record<string, string> = { USD: "$", EUR: "€", TRY: "₺", GBP: "£" };
        return `${symbols[currency] || ""}${amount?.toLocaleString('tr-TR') || 0}`;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR');
    };

    const handleDelete = async (id: string, proposalNo: string) => {
        if (!confirm(`"${proposalNo}" numaralı teklifi silmek istediğinize emin misiniz?`)) {
            return;
        }

        const { error } = await supabase
            .from('proposals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Delete error:", error);
            alert("Silme işlemi başarısız: " + error.message);
        } else {
            setProposals(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const { error } = await supabase
            .from('proposals')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            console.error("Status update error:", error);
            alert("Durum güncellenemedi: " + error.message);
        } else {
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        }
        setShowStatusMenu(null);
    };

    // Calculate follow-up stats
    const overdueCount = proposals.filter(p => {
        if (!p.next_follow_up_date) return false;
        const date = new Date(p.next_follow_up_date);
        return date < new Date();
    }).length;

    const todayCount = proposals.filter(p => {
        if (!p.next_follow_up_date) return false;
        const date = new Date(p.next_follow_up_date).toDateString();
        return date === new Date().toDateString();
    }).length;

    return (
        <>
            <Header title="Teklifler" />
            <main className="flex-1 p-4 md:p-6 md:px-10 overflow-y-auto">
                <div className="flex flex-col md:flex-row md:flex-wrap justify-between items-start md:items-end gap-4 mb-6 md:mb-8">
                    <div className="flex flex-col gap-1">
                        <p className="text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em] text-text-main dark:text-white">Teklifler</p>
                        <p className="text-text-secondary text-sm md:text-base font-normal">Tüm tekliflerinizi görüntüleyin ve yönetin.</p>
                    </div>
                    <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                            <input
                                type="text"
                                placeholder="Teklif ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary w-full md:w-64"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            <Filter size={18} />
                            <span className="hidden md:inline">Filtrele</span>
                        </button>
                    </div>
                </div>

                {/* Stats with Follow-up Tracking */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <StatCard label="Toplam Teklif" value={proposals.length.toString()} />
                    <StatCard label="Taslak" value={proposals.filter(p => p.status === 'draft').length.toString()} />
                    <StatCard label="Onaylanan" value={proposals.filter(p => p.status === 'approved').length.toString()} />
                    <StatCard
                        label="Geciken Takip"
                        value={overdueCount.toString()}
                        highlight={overdueCount > 0 ? 'red' : undefined}
                    />
                    <StatCard
                        label="Bugün Takip"
                        value={todayCount.toString()}
                        highlight={todayCount > 0 ? 'orange' : undefined}
                    />
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredProposals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
                            <FileText size={48} className="mb-4 opacity-50" />
                            <p className="font-medium">Henüz teklif yok</p>
                            <p className="text-sm">Yeni bir teklif yüklemek için "Teklif Yükle" sayfasını kullanın.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                                    <tr>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Teklif No</th>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Müşteri</th>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary hidden md:table-cell">Temsilci</th>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary hidden lg:table-cell">Tutar</th>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Takip</th>
                                        <th className="text-left px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Durum</th>
                                        <th className="text-right px-4 md:px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {filteredProposals.map((proposal) => {
                                        const status = statusConfig[proposal.status] || statusConfig.draft;
                                        return (
                                            <tr key={proposal.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 md:px-6 py-4">
                                                    <span className="font-bold text-primary">{proposal.proposal_no}</span>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-text-main dark:text-white">{proposal.customer_name}</p>
                                                        <p className="text-xs text-text-secondary truncate max-w-xs">{proposal.work_description}</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                                                    <span className="text-sm text-text-main dark:text-white">{proposal.representative_name || "-"}</span>
                                                </td>
                                                <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                                                    <span className="font-bold text-text-main dark:text-white">{formatCurrency(proposal.amount, proposal.currency)}</span>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <FollowUpBadge
                                                        nextFollowUpDate={proposal.next_follow_up_date}
                                                        missedCount={proposal.missed_follow_up_count || 0}
                                                        onClick={() => setFollowUpProposal(proposal)}
                                                    />
                                                </td>
                                                <td className="px-4 md:px-6 py-4 relative">
                                                    <button
                                                        onClick={() => setShowStatusMenu(showStatusMenu === proposal.id ? null : proposal.id)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.color} hover:opacity-80 pointer-events-none md:pointer-events-auto md:cursor-pointer`}
                                                    >
                                                        {status.icon}
                                                        {status.label}
                                                    </button>
                                                    {showStatusMenu === proposal.id && (
                                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg py-1 min-w-[140px]">
                                                            {Object.entries(statusConfig).map(([key, conf]) => (
                                                                <button
                                                                    key={key}
                                                                    onClick={() => handleStatusChange(proposal.id, key)}
                                                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 ${proposal.status === key ? 'bg-gray-50 dark:bg-white/5' : ''}`}
                                                                >
                                                                    {conf.icon}
                                                                    {conf.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex justify-end gap-1 md:gap-2">
                                                        <button
                                                            onClick={() => setSelectedProposal(proposal)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-text-secondary transition-colors"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-text-secondary transition-colors hidden md:block">
                                                            <Edit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(proposal.id, proposal.proposal_no)}
                                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            {selectedProposal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProposal(null)}>
                    <div className="bg-white dark:bg-surface-dark rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-black text-primary">{selectedProposal.proposal_no}</h2>
                                <p className="text-text-secondary text-sm">{selectedProposal.customer_name}</p>
                            </div>
                            <button onClick={() => setSelectedProposal(null)} className="text-text-secondary hover:text-text-main p-2">
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-bold text-text-secondary uppercase">Temsilci</p>
                                    <p className="font-medium text-text-main dark:text-white">{selectedProposal.representative_name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-text-secondary uppercase">Bölüm</p>
                                    <p className="font-medium text-text-main dark:text-white">{deptLabels[selectedProposal.department_code] || selectedProposal.department_code}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-text-secondary uppercase">Tutar</p>
                                    <p className="font-bold text-primary text-lg">{formatCurrency(selectedProposal.amount, selectedProposal.currency)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-text-secondary uppercase">Tarih</p>
                                    <p className="font-medium text-text-main dark:text-white">{formatDate(selectedProposal.offer_date)}</p>
                                </div>
                            </div>

                            {/* Follow-up Info */}
                            <div className="bg-background-light dark:bg-background-dark p-4 rounded-lg">
                                <p className="text-xs font-bold text-text-secondary uppercase mb-2">Takip Bilgisi</p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-sm text-text-secondary">Sonraki Takip:</span>
                                            <span className="ml-2 font-medium text-text-main dark:text-white">
                                                {selectedProposal.next_follow_up_date
                                                    ? formatDate(selectedProposal.next_follow_up_date)
                                                    : 'Planlanmadı'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-sm text-text-secondary">Kaçırılan:</span>
                                            <span className={`ml-2 font-bold ${selectedProposal.missed_follow_up_count > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {selectedProposal.missed_follow_up_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedProposal(null);
                                            setFollowUpProposal(selectedProposal);
                                        }}
                                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                                    >
                                        Takip Planla
                                    </button>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-text-secondary uppercase mb-2">Açıklama</p>
                                <p className="text-text-main dark:text-white bg-background-light dark:bg-background-dark p-3 rounded-lg">{selectedProposal.work_description || 'Açıklama yok'}</p>
                            </div>

                            {selectedProposal.pdf_url && (
                                <div>
                                    <p className="text-xs font-bold text-text-secondary uppercase mb-2">Teklif Dosyası</p>
                                    <a
                                        href={selectedProposal.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors w-fit"
                                    >
                                        <FileText size={20} />
                                        PDF Görüntüle
                                    </a>
                                </div>
                            )}

                            <div className="hidden md:block">
                                <p className="text-xs font-bold text-text-secondary uppercase mb-2">Durumu Değiştir</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(statusConfig).map(([key, conf]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                handleStatusChange(selectedProposal.id, key);
                                                setSelectedProposal({ ...selectedProposal, status: key });
                                            }}
                                            className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${selectedProposal.status === key ? conf.color : 'bg-gray-100 dark:bg-white/5 text-text-secondary hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                        >
                                            {conf.icon}
                                            {conf.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Follow-up Modal */}
            {followUpProposal && user && (
                <FollowUpModal
                    isOpen={true}
                    onClose={() => setFollowUpProposal(null)}
                    proposalId={followUpProposal.id}
                    proposalNo={followUpProposal.proposal_no}
                    customerName={followUpProposal.customer_name}
                    currentDate={followUpProposal.next_follow_up_date}
                    representativeId={followUpProposal.representative_id || user.id}
                    onSuccess={() => {
                        fetchProposals();
                        setFollowUpProposal(null);
                    }}
                />
            )}
        </>
    );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'orange' }) {
    const highlightClass = highlight === 'red'
        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
        : highlight === 'orange'
            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
            : '';

    const textClass = highlight === 'red'
        ? 'text-red-600 dark:text-red-400'
        : highlight === 'orange'
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-text-main dark:text-white';

    return (
        <div className={`bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4 ${highlightClass}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">{label}</p>
            <p className={`text-2xl font-black ${textClass}`}>{value}</p>
        </div>
    );
}
