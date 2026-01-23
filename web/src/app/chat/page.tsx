"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { Send, Bot, User, Loader2, FileText, Sparkles, TrendingUp, Calculator, Calendar } from "lucide-react";

interface Summary {
    type: 'count' | 'sum' | 'avg';
    value: number;
    label: string;
    currency?: string;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    data?: any[];
    summary?: Summary | null;
    timestamp: Date;
}

interface Proposal {
    id: string;
    proposal_no: string;
    customer_name: string;
    representative_name: string;
    amount: number;
    currency: string;
    status: string;
    department_code: string;
}

const statusLabels: Record<string, string> = {
    draft: "Taslak",
    sent: "Gönderildi",
    approved: "Onaylandı",
    revised: "Revize",
    cancelled: "İptal",
    rejected: "Reddedildi"
};

const deptLabels: Record<string, string> = {
    "01": "Havuz",
    "02": "Solar",
    "03": "Klima",
    "04": "Diğer"
};

const EXAMPLE_PROMPTS = [
    "Geçen ay toplam ne kadar satış yaptık?",
    "En çok hangi müşteriye teklif verdik?",
    "Solar bölümünde kaç onaylı teklif var?",
    "Bu yıl toplam teklif tutarı nedir?",
    "Son 7 günde kaç teklif oluşturuldu?"
];

export default function ChatPage() {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Merhaba! 👋 Ben Teklif Yönetim Asistanınızım. Artık işletmenizle ilgili detaylı analizler yapabilirim.\n\nÖrneğin:\n• \"Geçen ay toplam ne kadar satış yaptık?\"\n• \"Klima bölümünde kaç onaylı teklif var?\"",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        console.log("Chat Page v1.2 Loaded");
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('chat-query', {
                body: {
                    query: userMessage.content,
                    user_id: user?.id,
                    user_role: profile?.role
                }
            });

            if (error) throw error;

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.reply || data.message || (data.error ? `Error: ${data.message || data.error}` : "Yanıt alınamadı."),
                data: data.data,
                summary: data.summary,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (err: any) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExampleClick = (prompt: string) => {
        setInput(prompt);
    };

    const formatCurrency = (amount: number, currency: string) => {
        const symbols: Record<string, string> = { USD: "$", EUR: "€", TRY: "₺", GBP: "£" };
        return `${symbols[currency] || ""}${amount?.toLocaleString('tr-TR') || 0}`;
    };

    return (
        <>
            <Header title="Yapay Zeka Chatbot v1.2" />
            <main className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden">

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>

                            {message.role === "assistant" && (
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <Bot className="text-primary" size={20} />
                                </div>
                            )}

                            <div className={`max-w-2xl ${message.role === "user" ? "order-first" : ""}`}>
                                <div className={`rounded-2xl px-4 py-3 shadow-sm ${message.role === "user"
                                    ? "bg-primary text-black rounded-br-sm"
                                    : "bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-bl-sm"
                                    }`}>
                                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                </div>

                                {/* Summary Card */}
                                {message.summary && (
                                    <div className="mt-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 flex items-center gap-4 transition-transform hover:scale-[1.02]">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            {message.summary.type === 'sum' ? <Calculator size={24} /> : <TrendingUp size={24} />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">{message.summary.label}</p>
                                            <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100">
                                                {message.summary.type === 'sum'
                                                    ? formatCurrency(message.summary.value, message.summary.currency || 'TRY')
                                                    : message.summary.value}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Proposal Cards */}
                                {message.data && Array.isArray(message.data) && message.data.length > 0 && !message.summary && (
                                    <div className="mt-3 space-y-2">
                                        {message.data.slice(0, 5).map((proposal: Proposal) => (
                                            <div key={proposal.id} className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg p-3 flex items-center gap-4 hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <FileText className="text-primary" size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-primary text-sm">{proposal.proposal_no}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-text-secondary">
                                                            {statusLabels[proposal.status] || proposal.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-text-main dark:text-white truncate">{proposal.customer_name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                                                        <span>{deptLabels[proposal.department_code] || "Diğer"}</span>
                                                        {proposal.representative_name && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{proposal.representative_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-text-main dark:text-white">{formatCurrency(proposal.amount, proposal.currency)}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {message.data.length > 5 && (
                                            <p className="text-xs text-text-secondary text-center py-2 bg-gray-50 dark:bg-white/5 rounded-lg border border-border-light dark:border-border-dark">
                                                ... ve {message.data.length - 5} teklif daha
                                            </p>
                                        )}
                                    </div>
                                )}

                                <p className="text-xs text-text-secondary mt-1 px-1 flex items-center gap-1 justify-end opacity-70">
                                    {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>

                            {message.role === "user" && (
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                    <User className="text-text-secondary" size={20} />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Bot className="text-primary" size={20} />
                            </div>
                            <div className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-text-secondary">
                                    <Loader2 className="animate-spin" size={16} />
                                    <span className="text-sm">Hesaplıyorum...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Example Prompts */}
                {messages.length === 1 && (
                    <div className="px-6 pb-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                            {EXAMPLE_PROMPTS.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleExampleClick(prompt)}
                                    className="px-4 py-2 text-sm bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-full hover:border-primary hover:text-primary transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <Sparkles size={14} className="text-yellow-500" />
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3 max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="İşletmeniz hakkında bir soru sorun (örn. Geçen ayki toplam satış)..."
                            disabled={isLoading}
                            className="flex-1 bg-background-light dark:bg-background-dark border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            Gönder
                        </button>
                    </form>
                </div>
            </main>
        </>
    );
}
