"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { CloudUpload, User, Calendar, DollarSign, FileText, CheckCircle, RefreshCcw, Save, Trash, AlertCircle, Loader2, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

interface ParsedData {
    customer_name: string | null;
    representative_name: string | null;
    offer_date: string | null;
    total_amount: number | null;
    currency: string | null;
    work_description: string | null;
    proposal_content?: string | null;
    payment_terms?: string | null;
    department_prediction: string | null;
    product_items?: any[];
}

export default function UploadPage() {
    const { session, isAdmin, loading } = useAuth(); // Get session for token
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedDisplay, setExtractedDisplay] = useState(false);
    const [progress, setProgress] = useState(0);
    const [formData, setFormData] = useState<ParsedData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !isAdmin) {
            router.push('/');
        }
    }, [isAdmin, loading, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            startRealScan(e.target.files[0]);
        }
    };

    const startRealScan = async (selectedFile: File) => {
        setFile(selectedFile);
        setIsScanning(true);
        setExtractedDisplay(false);
        setProgress(10);
        setError(null);
        setUploadedFilePath(null);

        try {
            if (selectedFile.size > 15000000) {
                throw new Error("Dosya çok büyük. Maksimum 15MB desteklenir.");
            }

            // 1. Upload to Supabase Storage
            setProgress(30);

            // Create a clean filename
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            console.log("DEBUG: Preparing upload...");
            console.log("DEBUG: File path:", filePath);
            console.log("DEBUG: Original File size:", selectedFile.size);

            // Sanitize file object
            const fileBody = new Blob([selectedFile], { type: selectedFile.type });
            console.log("DEBUG: Blob size:", fileBody.size);

            // Add a timeout to the upload request
            const uploadPromise = supabase.storage
                .from('proposals')
                .upload(filePath, fileBody, {
                    cacheControl: '3600',
                    upsert: false
                });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Upload timeout (30s)")), 30000)
            );

            console.log("DEBUG: Sending request to Supabase Storage...");

            // Race the upload against a timeout
            const result: any = await Promise.race([uploadPromise, timeoutPromise]);
            const { error: uploadError, data: uploadData } = result;

            console.log("DEBUG: Upload race finished.");
            console.log("DEBUG: Upload Error:", uploadError);
            console.log("DEBUG: Upload Data:", uploadData);

            if (uploadError) {
                console.error("Full Upload Error Object:", uploadError);
                throw new Error("Storage Upload Error: " + (uploadError.message || JSON.stringify(uploadError)));
            }

            setUploadedFilePath(filePath);

            // 2. Call Edge Function with file path
            setProgress(60);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            if (!session?.access_token) {
                throw new Error("Oturum süresi dolmuş. Lütfen sayfayı yenileyin.");
            }

            const response = await fetch(
                'https://xjmgwfcveqvumykjvrtj.supabase.co/functions/v1/parse-proposal',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        file_path: filePath,
                        file_type: selectedFile.type
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data?.error) throw new Error(data.error);

            // 3. Handle Success
            setProgress(100);
            setFormData(data);
            setExtractedDisplay(true);

        } catch (err: any) {
            console.error("Scanning Error:", err);
            if (err.name === 'AbortError') {
                setError("İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.");
            } else {
                setError(err.message || "Dosya analiz edilirken bir hata oluştu.");
            }
            setProgress(0);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <>
            <Header title="Teklif Yükle" />
            <main className="flex-1 p-6 md:px-10 overflow-y-auto">
                <div className="flex flex-wrap justify-between items-end gap-3 mb-8">
                    <div className="flex flex-col gap-1">
                        <p className="text-3xl font-black leading-tight tracking-[-0.033em] text-text-main dark:text-white">Teklif Yükle ve Veri Çıkarımı</p>
                        <p className="text-text-secondary text-base font-normal">PDF dosyalarındaki kalemleri anında çıkarın ve doğrulayın.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                    {/* Left Column: Upload & Status */}
                    <div className="xl:col-span-5 flex flex-col gap-6">

                        {/* Drag & Drop Area */}
                        <div className="flex flex-col bg-white dark:bg-surface-dark rounded-xl border-2 border-dashed border-border-light dark:border-border-dark p-8 items-center justify-center gap-4 group hover:border-primary transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".pdf"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CloudUpload className="text-primary" size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-text-main dark:text-white">Teklif PDF'ini Sürükle ve Bırak</p>
                                <p className="text-sm text-text-secondary">veya <span className="text-primary font-bold">Dosyalara Göz At</span> (Maks 10MB)</p>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <h4 className="font-bold text-red-700 dark:text-red-400">Analiz Hatası</h4>
                                    <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Progress / Scanning Card */}
                        {(isScanning || extractedDisplay) && !error && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-text-main dark:text-white">Mevcut İşlem</h3>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${extractedDisplay ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {extractedDisplay ? 'TAMAMLANDI' : 'İŞLENİYOR'}
                                    </span>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="relative w-20 h-20 rounded-lg bg-gray-100 dark:bg-white/10 overflow-hidden border border-gray-200 flex items-center justify-center">
                                        <FileText className="text-gray-400" size={40} />
                                        {isScanning && <div className="absolute inset-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-[scan_2s_infinite_linear]"></div>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-bold text-text-main dark:text-white">{file?.name}</p>
                                            <p className="text-xs text-primary font-bold">{progress}%</p>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
                                            <div className="bg-primary h-2 rounded-full shadow-[0_0_15px_rgba(19,236,91,0.2)] transition-all duration-100" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <p className="text-[10px] text-text-secondary mt-2 uppercase tracking-widest font-bold">
                                            {extractedDisplay ? 'Analiz Tamamlandı' : 'Veriler Çıkarılıyor...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Column: Extraction Form */}
                    <div className="xl:col-span-7">
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 opacity-90">
                            {extractedDisplay && formData ? (
                                <ExtractionForm data={formData} file={file} uploadedFilePath={uploadedFilePath} />
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-text-secondary opacity-50">
                                    {isScanning ? (
                                        <Loader2 className="animate-spin mb-4 text-primary" size={48} />
                                    ) : (
                                        <CloudUpload size={48} className="mb-4" />
                                    )}
                                    <p>{isScanning ? 'Yapay Zeka Analiz Ediyor...' : 'Henüz veri yok. Lütfen bir dosya yükleyin.'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </main>
            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
            `}</style>
        </>
    );
}

function ExtractionForm({ data, rawAiData, file, uploadedFilePath }: { data: ParsedData; rawAiData?: ParsedData; file: File | null; uploadedFilePath: string | null }) {
    const { user, session } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedProposalNo, setSavedProposalNo] = useState<string | null>(null);

    // Form state
    const [department, setDepartment] = useState(data.department_prediction || "04-Diğer");
    const [customerName, setCustomerName] = useState(data.customer_name || "");
    const [representativeName, setRepresentativeName] = useState(data.representative_name || "");
    const [offerDate, setOfferDate] = useState(data.offer_date || "");
    const [workDescription, setWorkDescription] = useState(data.work_description || "");
    const [amount, setAmount] = useState(data.total_amount?.toString() || "0");
    const [currency, setCurrency] = useState(data.currency || "TRY");

    // Representative matching state
    const [existingReps, setExistingReps] = useState<{ id: string, full_name: string }[]>([]);
    const [matchedRep, setMatchedRep] = useState<{ id: string, full_name: string } | null>(null);
    const [similarRep, setSimilarRep] = useState<{ id: string, full_name: string } | null>(null);
    const [showRepConfirm, setShowRepConfirm] = useState(false);
    const [repAction, setRepAction] = useState<'existing' | 'new' | null>(null);

    // Fetch existing representatives on mount
    useEffect(() => {
        const fetchReps = async () => {
            const { data: reps } = await supabase
                .from('representatives')
                .select('id, full_name')
                .eq('is_active', true);
            setExistingReps(reps || []);
        };
        fetchReps();
    }, []);

    // Check for matching/similar representatives when name changes
    useEffect(() => {
        if (!representativeName || existingReps.length === 0) {
            setMatchedRep(null);
            setSimilarRep(null);
            return;
        }

        const normalized = representativeName.toLowerCase().trim();

        // Exact match
        const exact = existingReps.find(r => r.full_name.toLowerCase().trim() === normalized);
        if (exact) {
            setMatchedRep(exact);
            setSimilarRep(null);
            setRepAction('existing');
            return;
        }

        // Similar match (Levenshtein-like check)
        const similar = existingReps.find(r => {
            const repName = r.full_name.toLowerCase().trim();
            // Check if names share common parts
            const repParts = repName.split(' ');
            const inputParts = normalized.split(' ');
            const commonParts = repParts.filter(p => inputParts.some(ip => ip.includes(p) || p.includes(ip)));
            return commonParts.length > 0 && commonParts.length < Math.max(repParts.length, inputParts.length);
        });

        if (similar) {
            setSimilarRep(similar);
            setMatchedRep(null);
            setShowRepConfirm(true);
        } else {
            setMatchedRep(null);
            setSimilarRep(null);
            setRepAction('new');
        }
    }, [representativeName, existingReps]);

    // Parse date handling extra text like "15.01.2026 (Rvz 5)"
    const parseOfferDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        // Extract just the date part (DD.MM.YYYY) using regex
        const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (match) {
            const [, day, month, year] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return null;
    };

    const handleSave = async () => {
        console.log("handleSave started");
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            console.log("Preparing data...");
            // Extract department code (e.g., "03" from "03-Klima")
            const deptCode = department.split('-')[0] || "04";
            const deptName = department.split('-')[1] || "Diğer";

            // Handle representative: create if new (skip errors)
            let finalRepId: string | null = matchedRep?.id || null;
            let finalRepName = representativeName;

            console.log("Processing representative...", repAction);

            if (repAction === 'new' && representativeName) {
                try {
                    console.log("Inserting new representative...");
                    const { data: newRep, error: repErr } = await supabase
                        .from('representatives')
                        .insert({
                            full_name: representativeName,
                            department: deptName,
                            role: 'Müşteri Temsilcisi'
                        })
                        .select('id')
                        .single();

                    if (repErr) {
                        console.warn('Rep insert warning:', repErr);
                    } else if (newRep) {
                        console.log("Representative inserted with ID:", newRep.id);
                        finalRepId = newRep.id;
                    }
                } catch (repErr) {
                    console.warn('Rep insert skipped:', repErr);
                }
            } else if (repAction === 'existing' && matchedRep) {
                finalRepName = matchedRep.full_name;
            }

            console.log("Preparing proposal insert object...");

            const insertData = {
                department_code: deptCode,
                customer_name: customerName,
                representative_name: finalRepName,
                work_description: workDescription,
                amount: parseFloat(amount.replace(',', '.')) || 0,
                currency: currency as 'TRY' | 'USD' | 'EUR' | 'GBP',
                offer_date: parseOfferDate(offerDate),
                raw_ai_data: rawAiData || data,
                product_items: data.product_items || [],
                proposal_content: (rawAiData as any)?.proposal_content || null,
                payment_terms: (rawAiData as any)?.payment_terms || null,
                status: 'draft',
                pdf_url: uploadedFilePath, // Save the Supabase Storage path
                // CRITICAL: representative_id MUST equal auth.uid() for RLS policy to work
                representative_id: user?.id
            };

            // Ensure user is authenticated before insert
            if (!insertData.representative_id) {
                throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
            }
            console.log("Insert payload:", insertData);

            console.log("Executing Supabase INSERT...");

            // CRITICAL FIX: Don't use .select().single() - it requires RLS SELECT permission
            // which can cause infinite hang if RLS doesn't allow viewing the inserted row
            // UPDATE: RLS verified to allow selecting own rows or rows where representative_id = auth.uid()
            const { data: insertedData, error } = await supabase
                .from('proposals')
                .insert(insertData)
                .select('id, proposal_no')
                .single();

            if (error) {
                console.error("Supabase Insert Error:", error);
                throw error;
            }

            // INSERT succeeded
            console.log("Save successful! ID:", insertedData.id);
            setSavedProposalNo(insertedData.proposal_no);

            // 4. Trigger Embedding Generation (RAG)
            console.log("Triggering indexing...");

            // We don't await this if we want to return fast, OR we await to show "Indexing..." status.
            // User requested "Search after upload", so better to ensure it's indexed.
            // But don't block UI too long. Let's fire and forget, or show a toast?
            // The user just wants to know it's saved.
            // However, debugging RAG requires knowing if it happened.
            // Let's await it but handle errors gracefully (don't fail the whole save if indexing fails).

            try {
                const indexResponse = await fetch(
                    'https://xjmgwfcveqvumykjvrtj.supabase.co/functions/v1/index-proposal',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({
                            proposal_id: insertedData.id
                        })
                    }
                );

                if (!indexResponse.ok) {
                    console.error("Indexing failed:", await indexResponse.text());
                } else {
                    console.log("Indexing triggered successfully");
                }
            } catch (indexErr) {
                console.error("Indexing fetch error:", indexErr);
            }

            setSaveSuccess(true);
        } catch (err: any) {
            console.error("Save Catch Error:", err);
            // Show detailed error if available
            setSaveError(err.message || err.details || err.hint || "Teklif kaydedilirken bir hata oluştu.");
        } finally {
            console.log("handleSave finally block");
            setIsSaving(false);
        }
    };

    if (saveSuccess) {
        return (
            <div className="flex flex-col items-center justify-center py-16 animate-in fade-in">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                    <CheckCircle className="text-primary" size={48} />
                </div>
                <h2 className="text-2xl font-black text-text-main dark:text-white mb-2">Teklif Kaydedildi!</h2>
                <p className="text-text-secondary mb-4">Teklif numaranız: <span className="font-bold text-primary">{savedProposalNo}</span></p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-primary text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                    Yeni Teklif Yükle
                </button>
            </div>
        );
    }

    return (
        <form className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="flex items-center justify-between mb-6 border-b border-border-light dark:border-border-dark pb-4">
                <div>
                    <h2 className="text-xl font-bold text-text-main dark:text-white">Çıkarılan Veriler</h2>
                    <p className="text-sm text-text-secondary">Kaydetmeden önce yapay zeka sonuçlarını doğrulayın.</p>
                </div>
                <button type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-text-secondary">
                    <RefreshCcw size={20} />
                </button>
            </div>

            {saveError && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {saveError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-main dark:text-white">Bölüm</label>
                    <select
                        className="bg-background-light dark:bg-background-dark border-none rounded-lg text-sm h-11 px-3 outline-none focus:ring-1 focus:ring-primary"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                    >
                        <option>01-Havuz</option>
                        <option>02-Solar</option>
                        <option>03-Klima</option>
                        <option>04-Diğer</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-main dark:text-white">Teklif No</label>
                    <div className="relative">
                        <input className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-lg text-sm text-text-secondary h-11 px-3 cursor-not-allowed outline-none" readOnly type="text" value="OTOMATİK" />
                        <span className="absolute right-3 top-3 text-[10px] bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded font-bold uppercase text-text-secondary">Oto</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-main dark:text-white">Müşteri Adı</label>
                    <div className="relative">
                        <input
                            className="w-full bg-primary/5 border border-primary/20 rounded-lg text-sm h-11 px-3 outline-none focus:ring-1 focus:ring-primary"
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <span className="absolute right-3 top-3.5 text-[10px] text-primary font-black flex items-center gap-1">
                            <CheckCircle size={12} className="fill-current" /> AI
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-main dark:text-white">Müşteri Temsilcisi</label>
                    <div className="relative">
                        <input
                            className="w-full bg-primary/5 border border-primary/20 rounded-lg text-sm h-11 px-3 pr-20 outline-none focus:ring-1 focus:ring-primary"
                            type="text"
                            value={representativeName}
                            onChange={(e) => { setRepresentativeName(e.target.value); setShowRepConfirm(false); }}
                            placeholder="Temsilci adı"
                        />
                        {matchedRep && (
                            <span className="absolute right-3 top-3 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <UserCheck size={12} /> Mevcut
                            </span>
                        )}
                        {!matchedRep && !similarRep && representativeName && (
                            <span className="absolute right-3 top-3 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <UserPlus size={12} /> Yeni
                            </span>
                        )}
                    </div>

                    {showRepConfirm && similarRep && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-1">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                🤔 Bu isim mevcut temsilci <strong>{similarRep.full_name}</strong> ile benzer görünüyor. Aynı kişi mi?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRepresentativeName(similarRep.full_name);
                                        setMatchedRep(similarRep);
                                        setSimilarRep(null);
                                        setShowRepConfirm(false);
                                        setRepAction('existing');
                                    }}
                                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded hover:bg-green-600"
                                >
                                    Evet, aynı kişi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRepConfirm(false);
                                        setSimilarRep(null);
                                        setRepAction('new');
                                    }}
                                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-text-main dark:text-white text-xs font-bold rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                    Hayır, yeni kişi
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-text-main dark:text-white">Tarih</label>
                    <input
                        className="bg-background-light dark:bg-background-dark border-none rounded-lg text-sm h-11 px-3 outline-none focus:ring-1 focus:ring-primary"
                        type="text"
                        value={offerDate}
                        onChange={(e) => setOfferDate(e.target.value)}
                        placeholder="GG.AA.YYYY"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-text-main dark:text-white">İş Açıklaması</label>
                <textarea
                    className="bg-background-light dark:bg-background-dark border-none rounded-lg text-sm p-3 outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Tutar</label>
                    <input
                        className="bg-white dark:bg-black/20 border-none rounded-lg text-lg font-bold h-12 px-3 outline-none"
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Para Birimi</label>
                    <select
                        className="bg-white dark:bg-black/20 border-none rounded-lg text-sm font-bold h-12 px-3 outline-none"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                    >
                        <option>EUR</option>
                        <option>USD</option>
                        <option>TRY</option>
                        <option>GBP</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-primary">USD Karşılığı</label>
                    <div className="flex items-center h-12 px-4 bg-primary/10 rounded-lg border border-primary/20 text-lg font-black text-text-main dark:text-white">
                        {currency === "USD" ? `$${parseFloat(amount.replace(',', '.') || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '(Dönüşüm Gerekli)'}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-border-light dark:border-border-dark">
                <button type="button" className="px-6 py-3 text-sm font-bold text-text-secondary hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    Vazgeç
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-black text-sm font-black rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Kaydediliyor...' : 'Teklifi Kaydet'}
                </button>
            </div>

        </form>
    );
}
