"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { Search, Filter, MoreHorizontal, Phone, Mail, Award, Plus, Trash2, Edit, X, User, Building, Loader2 } from "lucide-react";

interface Representative {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    department: string;
    role: string;
    is_active: boolean;
    // Calculated stats
    total_proposals?: number;
    approved_proposals?: number;
    total_amount?: number;
}

interface ProposalStats {
    rep_name: string;
    count: number;
    approved: number;
    total: number;
}

export default function RepresentativesPage() {
    const [representatives, setRepresentatives] = useState<Representative[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingRep, setEditingRep] = useState<Representative | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [formPhone, setFormPhone] = useState("");
    const [formDepartment, setFormDepartment] = useState("Klima");
    const [formRole, setFormRole] = useState("Müşteri Temsilcisi");

    useEffect(() => {
        fetchRepresentatives();
    }, []);

    const fetchRepresentatives = async () => {
        setLoading(true);

        // Fetch representatives
        const { data: reps, error } = await supabase
            .from('representatives')
            .select('*')
            .eq('is_active', true)
            .order('full_name');

        if (error) {
            console.error("Error fetching representatives:", error);
            setLoading(false);
            return;
        }

        // Fetch proposal stats by representative_name
        const { data: proposals } = await supabase
            .from('proposals')
            .select('representative_name, amount, status');

        // Calculate stats per representative
        const statsMap: Record<string, ProposalStats> = {};
        proposals?.forEach(p => {
            const name = p.representative_name || 'Unknown';
            if (!statsMap[name]) {
                statsMap[name] = { rep_name: name, count: 0, approved: 0, total: 0 };
            }
            statsMap[name].count++;
            statsMap[name].total += parseFloat(p.amount) || 0;
            if (p.status === 'approved') statsMap[name].approved++;
        });

        // Merge stats into representatives
        const enrichedReps = reps?.map(rep => {
            const stats = statsMap[rep.full_name] || { count: 0, approved: 0, total: 0 };
            return {
                ...rep,
                total_proposals: stats.count,
                approved_proposals: stats.approved,
                total_amount: stats.total
            };
        }) || [];

        setRepresentatives(enrichedReps);
        setLoading(false);
    };

    const openAddModal = () => {
        setEditingRep(null);
        setFormName("");
        setFormEmail("");
        setFormPhone("");
        setFormDepartment("Klima");
        setFormRole("Müşteri Temsilcisi");
        setShowModal(true);
    };

    const openEditModal = (rep: Representative) => {
        setEditingRep(rep);
        setFormName(rep.full_name);
        setFormEmail(rep.email || "");
        setFormPhone(rep.phone || "");
        setFormDepartment(rep.department || "Klima");
        setFormRole(rep.role || "Müşteri Temsilcisi");
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;
        setSaving(true);

        try {
            if (editingRep) {
                // Update
                await supabase
                    .from('representatives')
                    .update({
                        full_name: formName,
                        email: formEmail,
                        phone: formPhone,
                        department: formDepartment,
                        role: formRole
                    })
                    .eq('id', editingRep.id);
            } else {
                // Insert
                await supabase
                    .from('representatives')
                    .insert({
                        full_name: formName,
                        email: formEmail,
                        phone: formPhone,
                        department: formDepartment,
                        role: formRole
                    });
            }

            setShowModal(false);
            fetchRepresentatives();
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`"${name}" adlı temsilciyi silmek istediğinize emin misiniz?`)) return;

        await supabase
            .from('representatives')
            .update({ is_active: false })
            .eq('id', id);

        fetchRepresentatives();
    };

    const filteredReps = representatives.filter(r =>
        r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount: number) => {
        return `$${amount?.toLocaleString('tr-TR') || 0}`;
    };

    return (
        <>
            <Header title="Temsilciler" />
            <main className="flex-1 p-8 space-y-8 overflow-y-auto">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-text-main dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">Satış Ekibi</h1>
                        <p className="text-text-secondary text-base font-normal">Temsilcilerin performans ve detaylarını görüntüleyin.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex h-10 w-full md:w-64 items-center rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 shadow-sm">
                            <Search size={18} className="text-text-secondary mr-2" />
                            <input
                                type="text"
                                placeholder="Temsilci ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-full w-full bg-transparent text-sm text-text-main dark:text-white placeholder:text-text-secondary outline-none"
                            />
                        </div>
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 h-10 px-4 bg-primary text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                        >
                            <Plus size={18} />
                            Yeni Temsilci
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Toplam Temsilci" value={representatives.length.toString()} />
                    <StatCard label="Toplam Teklif" value={representatives.reduce((a, r) => a + (r.total_proposals || 0), 0).toString()} />
                    <StatCard label="Onaylanan" value={representatives.reduce((a, r) => a + (r.approved_proposals || 0), 0).toString()} />
                    <StatCard label="Toplam Satış" value={formatCurrency(representatives.reduce((a, r) => a + (r.total_amount || 0), 0))} />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : filteredReps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
                        <User size={48} className="mb-4 opacity-50" />
                        <p className="font-medium">Henüz temsilci yok</p>
                        <p className="text-sm">Yeni temsilci eklemek için yukarıdaki butonu kullanın.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredReps.map((rep) => (
                            <div key={rep.id} className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow group relative">
                                <div className="absolute top-4 right-4 flex gap-1 z-10">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openEditModal(rep); }}
                                        className="p-1.5 text-text-secondary hover:text-primary transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(rep.id, rep.full_name); }}
                                        className="p-1.5 text-text-secondary hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <Link href={`/representatives/${rep.id}`} className="flex flex-col items-center w-full">
                                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                                        <span className="text-2xl font-black text-primary">
                                            {rep.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-text-main dark:text-white mb-1 group-hover:text-primary transition-colors">{rep.full_name}</h3>
                                    <p className="text-text-secondary text-sm font-medium mb-1">{rep.role}</p>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold mb-4">
                                        {rep.department}
                                    </span>

                                    <div className="flex items-center gap-3 mb-4 w-full justify-center">
                                        <div className="text-center">
                                            <p className="text-xl font-black text-text-main dark:text-white">{rep.total_proposals || 0}</p>
                                            <p className="text-[10px] text-text-secondary uppercase font-bold">Teklif</p>
                                        </div>
                                        <div className="w-px h-8 bg-border-light dark:bg-border-dark"></div>
                                        <div className="text-center">
                                            <p className="text-xl font-black text-green-500">{rep.approved_proposals || 0}</p>
                                            <p className="text-[10px] text-text-secondary uppercase font-bold">Onay</p>
                                        </div>
                                    </div>

                                    <div className="w-full border-t border-border-light dark:border-border-dark pt-4">
                                        <p className="text-[10px] text-text-secondary font-bold uppercase mb-1">Toplam Satış</p>
                                        <p className="text-lg font-black text-primary">{formatCurrency(rep.total_amount || 0)}</p>
                                    </div>
                                </Link>

                                {(rep.email || rep.phone) && (
                                    <div className="w-full border-t border-border-light dark:border-border-dark pt-4 mt-4 flex justify-center gap-3 z-10">
                                        {rep.phone && (
                                            <a href={`tel:${rep.phone}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-full bg-background-light dark:bg-white/5 flex items-center justify-center text-text-secondary hover:text-primary transition-colors">
                                                <Phone size={14} />
                                            </a>
                                        )}
                                        {rep.email && (
                                            <a href={`mailto:${rep.email}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-full bg-background-light dark:bg-white/5 flex items-center justify-center text-text-secondary hover:text-primary transition-colors">
                                                <Mail size={14} />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-text-main dark:text-white">
                                {editingRep ? "Temsilci Düzenle" : "Yeni Temsilci"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-main">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-text-main dark:text-white block mb-1">Ad Soyad *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full h-11 px-3 rounded-lg bg-background-light dark:bg-background-dark border-none text-sm outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Örn: Yusuf Akkuş"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-text-main dark:text-white block mb-1">E-posta</label>
                                    <input
                                        type="email"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full h-11 px-3 rounded-lg bg-background-light dark:bg-background-dark border-none text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="email@siba.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-text-main dark:text-white block mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        value={formPhone}
                                        onChange={(e) => setFormPhone(e.target.value)}
                                        className="w-full h-11 px-3 rounded-lg bg-background-light dark:bg-background-dark border-none text-sm outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="+90 533 XXX XX XX"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-text-main dark:text-white block mb-1">Bölüm</label>
                                    <select
                                        value={formDepartment}
                                        onChange={(e) => setFormDepartment(e.target.value)}
                                        className="w-full h-11 px-3 rounded-lg bg-background-light dark:bg-background-dark border-none text-sm outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option>Havuz</option>
                                        <option>Solar</option>
                                        <option>Klima</option>
                                        <option>Diğer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-text-main dark:text-white block mb-1">Rol</label>
                                    <select
                                        value={formRole}
                                        onChange={(e) => setFormRole(e.target.value)}
                                        className="w-full h-11 px-3 rounded-lg bg-background-light dark:bg-background-dark border-none text-sm outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option>Müşteri Temsilcisi</option>
                                        <option>Kıdemli Temsilci</option>
                                        <option>Bölge Sorumlusu</option>
                                        <option>Satış Müdürü</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 h-11 rounded-lg border border-border-light dark:border-border-dark text-text-secondary font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formName.trim() || saving}
                                className="flex-1 h-11 rounded-lg bg-primary text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 className="animate-spin" size={16} />}
                                {editingRep ? "Güncelle" : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">{label}</p>
            <p className="text-2xl font-black text-text-main dark:text-white">{value}</p>
        </div>
    );
}
