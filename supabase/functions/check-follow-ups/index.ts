import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalWithFollowUp {
    id: string;
    proposal_no: string;
    customer_name: string;
    next_follow_up_date: string;
    missed_follow_up_count: number;
    representative_id: string;
    representative_name: string;
}

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const today = new Date().toISOString().split('T')[0];

        console.log(`[check-follow-ups] Running for date: ${today}`);

        // 1. Find proposals with missed follow-ups (next_follow_up_date < today)
        const { data: missedProposals, error: fetchError } = await supabase
            .from('proposals')
            .select(`
        id,
        proposal_no,
        customer_name,
        next_follow_up_date,
        missed_follow_up_count,
        representative_id,
        representative_name
      `)
            .lt('next_follow_up_date', today)
            .not('next_follow_up_date', 'is', null)
            .in('status', ['draft', 'sent', 'revised']);

        if (fetchError) {
            throw new Error(`Failed to fetch proposals: ${fetchError.message}`);
        }

        console.log(`[check-follow-ups] Found ${missedProposals?.length || 0} overdue follow-ups`);

        const processedIds: string[] = [];
        const notifications: any[] = [];

        for (const proposal of (missedProposals || []) as ProposalWithFollowUp[]) {
            // 2. Create a "missed" follow-up log entry
            const { error: logError } = await supabase
                .from('follow_up_logs')
                .insert({
                    proposal_id: proposal.id,
                    representative_id: proposal.representative_id,
                    action_type: 'missed',
                    scheduled_date: proposal.next_follow_up_date,
                    notes: `Otomatik: ${proposal.next_follow_up_date} tarihli takip kaçırıldı`
                });

            if (logError) {
                console.error(`[check-follow-ups] Log insert error for ${proposal.proposal_no}:`, logError);
                continue;
            }

            // 3. Increment missed_follow_up_count on the proposal
            const newMissedCount = (proposal.missed_follow_up_count || 0) + 1;
            const { error: updateError } = await supabase
                .from('proposals')
                .update({
                    missed_follow_up_count: newMissedCount,
                    // Push next follow-up to tomorrow (or admin can manually re-schedule)
                    next_follow_up_date: null
                })
                .eq('id', proposal.id);

            if (updateError) {
                console.error(`[check-follow-ups] Update error for ${proposal.proposal_no}:`, updateError);
                continue;
            }

            // 4. Create notification for the representative
            if (proposal.representative_id) {
                notifications.push({
                    user_id: proposal.representative_id,
                    proposal_id: proposal.id,
                    type: 'reminder',
                    title: 'Kaçırılan Takip',
                    message: `${proposal.customer_name} için ${proposal.proposal_no} nolu teklifin takibi kaçırıldı. Toplam ${newMissedCount} kez.`
                });
            }

            // 5. Update representative metrics using the function
            if (proposal.representative_id) {
                await supabase.rpc('update_representative_metrics', {
                    rep_id: proposal.representative_id
                });
            }

            processedIds.push(proposal.id);
        }

        // 6. Insert all notifications at once
        if (notifications.length > 0) {
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) {
                console.error('[check-follow-ups] Notification insert error:', notifyError);
            }
        }

        // 7. Get summary stats for admin
        const { data: adminUsers } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');

        // Notify admins about daily summary
        if (adminUsers && adminUsers.length > 0 && processedIds.length > 0) {
            const adminNotifications = adminUsers.map((admin: { id: string }) => ({
                user_id: admin.id,
                type: 'system',
                title: 'Günlük Takip Raporu',
                message: `Bugün ${processedIds.length} adet takip kaçırıldı. Detaylar için raporları inceleyin.`
            }));

            await supabase.from('notifications').insert(adminNotifications);
        }

        const result = {
            success: true,
            date: today,
            processed_count: processedIds.length,
            processed_ids: processedIds
        };

        console.log('[check-follow-ups] Completed:', result);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[check-follow-ups] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});
