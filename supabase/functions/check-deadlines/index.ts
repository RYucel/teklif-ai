
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
    try {
        // 1. Calculate "Tomorrow" date range
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Format to YYYY-MM-DD for comparison (assuming date column is date or timestamp)
        // Adjust logic based on your exact column type (timestamp vs date)
        const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

        console.log(`Checking deadlines between ${startOfDay} and ${endOfDay}`);

        // 2. Query proposals with next_follow_up_date in range
        // Using 'sent' or 'revised' status - usually 'draft' doesn't have a deadline, but maybe?
        // Let's check all active statuses.
        const { data: proposals, error: fetchError } = await supabase
            .from('proposals')
            .select('id, proposal_no, customer_name, representative_id, next_follow_up_date')
            .in('status', ['sent', 'revised'])
            .gte('next_follow_up_date', startOfDay)
            .lte('next_follow_up_date', endOfDay);

        if (fetchError) throw fetchError;

        console.log(`Found ${proposals?.length || 0} proposals expiring soon.`);

        if (!proposals || proposals.length === 0) {
            return new Response(JSON.stringify({ message: "No deadlines found for tomorrow." }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Create Notifications
        const notifications = proposals.map(p => ({
            user_id: p.representative_id,
            type: 'reminder',
            title: 'Takip Hatırlatması',
            message: `${p.proposal_no} nolu teklif (${p.customer_name}) için yarın takip günü!`,
            is_read: false
        }));

        const { error: insertError } = await supabase
            .from('notifications')
            .insert(notifications);

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            count: notifications.length,
            notifications
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
})
