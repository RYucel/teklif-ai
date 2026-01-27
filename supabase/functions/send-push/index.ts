
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { user_id, title, body, url } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get VAPID keys from env
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@example.com';

        if (!vapidPublicKey || !vapidPrivateKey) {
            throw new Error('VAPID keys not configured');
        }

        webpush.setVapidDetails(
            vapidEmail,
            vapidPublicKey,
            vapidPrivateKey
        );

        // Fetch subscriptions for user
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user_id);

        if (subError) throw subError;

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const payload = JSON.stringify({ title, body, url });

        const results = await Promise.all(subscriptions.map(async (sub) => {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                await webpush.sendNotification(pushSubscription, payload);
                return { success: true, id: sub.id };
            } catch (error) {
                console.error('Push error for sub', sub.id, error);

                // If 410 Gone, delete subscription
                if (error.statusCode === 410) {
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                }
                return { success: false, id: sub.id, error: error.message };
            }
        }));

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
