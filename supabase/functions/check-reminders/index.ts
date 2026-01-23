import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    try {
        // 1. Fetch proposals pending for > 5 days (and haven't been reminded in the last 5 days)
        // Calc date 5 days ago
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const dateStr = fiveDaysAgo.toISOString();

        const { data: proposals, error: fetchError } = await supabase
            .from("proposals")
            .select("id, proposal_no, customer_name, representative_id, created_at, last_reminder_sent_at")
            .in("status", ["draft", "sent", "revised"])
            .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${dateStr}`)
            .lt("created_at", dateStr);

        if (fetchError) throw fetchError;

        if (!proposals || proposals.length === 0) {
            return new Response(JSON.stringify({ message: "No stale proposals found." }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const updates = [];
        const notifications = [];

        // 2. Process each proposal
        for (const proposal of proposals) {
            // Create Notification Record
            notifications.push({
                user_id: proposal.representative_id,
                proposal_id: proposal.id,
                type: "reminder",
                title: `Hatırlatma: ${proposal.proposal_no}`,
                message: `${proposal.customer_name} müşterisi için 5 gündür işlem yapılmadı. Lütfen takip ediniz.`,
                is_read: false
            });

            // Update last_reminder_sent_at
            updates.push(proposal.id);
        }

        // 3. Batch Insert Notifications
        if (notifications.length > 0) {
            const { error: notifError } = await supabase
                .from("notifications")
                .insert(notifications);
            if (notifError) throw notifError;
        }

        // 4. Update Proposals (This would ideally be a batch update, but for simplicity loop or use custom query)
        // For now we just update timestamp. separate calls are easier in simple logic, batch via RPC is better for perf.
        // We will do simple iteration for this MVP or a single update query if IDs match.
        // To safe on calls, we can try to do it in one go if RLS allows or loop.
        for (const id of updates) {
            await supabase.from("proposals").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", id);
        }

        // 5. (Simulate) Send Push/Email
        console.log(`Sent Reminders for ${notifications.length} proposals.`);

        return new Response(
            JSON.stringify({
                success: true,
                processed_count: proposals.length,
                message: "Reminders processed successfully"
            }),
            { headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
