'use client';

import { useState } from 'react';
import { X, Calendar, MessageSquare, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface FollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposalId: string;
    proposalNo: string;
    customerName: string;
    currentDate?: string | null;
    representativeId: string;
    onSuccess: () => void;
}

export function FollowUpModal({
    isOpen,
    onClose,
    proposalId,
    proposalNo,
    customerName,
    currentDate,
    representativeId,
    onSuccess
}: FollowUpModalProps) {
    const [selectedDate, setSelectedDate] = useState(
        currentDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            // 1. Update proposal with next follow-up date
            const { error: updateError } = await supabase
                .from('proposals')
                .update({
                    next_follow_up_date: selectedDate
                })
                .eq('id', proposalId);

            if (updateError) throw updateError;

            // 2. Create follow-up log entry
            const { error: logError } = await supabase
                .from('follow_up_logs')
                .insert({
                    proposal_id: proposalId,
                    representative_id: representativeId,
                    action_type: 'scheduled',
                    scheduled_date: selectedDate,
                    notes: notes || `${customerName} için takip planlandı`
                });

            if (logError) throw logError;

            // 3. Increment follow_up_count via RPC or separate query
            // Note: Supabase client doesn't support raw SQL in .update()
            // The count will be managed via RPC or trigger

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Follow-up save error:', err);
            setError(err.message || 'Takip kaydedilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkCompleted = async () => {
        setIsSaving(true);
        setError(null);

        try {
            // 1. Update proposal
            const { error: updateError } = await supabase
                .from('proposals')
                .update({
                    next_follow_up_date: null,
                    last_contact_date: new Date().toISOString().split('T')[0]
                })
                .eq('id', proposalId);

            if (updateError) throw updateError;

            // 2. Create completed log entry
            const { error: logError } = await supabase
                .from('follow_up_logs')
                .insert({
                    proposal_id: proposalId,
                    representative_id: representativeId,
                    action_type: 'completed',
                    scheduled_date: currentDate || new Date().toISOString().split('T')[0],
                    completed_at: new Date().toISOString(),
                    notes: notes || 'Takip tamamlandı'
                });

            if (logError) throw logError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Complete follow-up error:', err);
            setError(err.message || 'İşlem başarısız');
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate quick date options
    const today = new Date();
    const quickDates = [
        { label: 'Yarın', date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000) },
        { label: '3 Gün', date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) },
        { label: '1 Hafta', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
        { label: '2 Hafta', date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000) },
        { label: '1 Ay', date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Takip Planla
                        </h2>
                        <p className="text-sm text-gray-500">
                            {proposalNo} - {customerName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Quick Date Buttons */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Hızlı Seçim
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {quickDates.map(({ label, date }) => (
                                <button
                                    key={label}
                                    onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${selectedDate === date.toISOString().split('T')[0]
                                        ? 'bg-primary text-white border-primary'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Takip Tarihi
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <MessageSquare className="w-4 h-4 inline mr-1" />
                            Notlar (Opsiyonel)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Takip hakkında not ekleyin..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                    {currentDate && (
                        <button
                            onClick={handleMarkCompleted}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            ✓ Tamamlandı
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {currentDate ? 'Ertele' : 'Planla'}
                    </button>
                </div>
            </div>
        </div>
    );
}
