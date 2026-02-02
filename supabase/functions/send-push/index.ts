import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FCM HTTP v1 API endpoint
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { user_id, title, body, data } = await req.json();

        console.log('Send push request for user:', user_id);

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // FCM Server Key from Firebase Console
        const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

        if (!fcmServerKey) {
            console.error('FCM_SERVER_KEY not configured');
            throw new Error('FCM_SERVER_KEY not configured. Add it in Supabase secrets.');
        }

        // Fetch subscriptions for user
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user_id);

        if (subError) {
            console.error('DB error:', subError);
            throw subError;
        }

        console.log('Found subscriptions:', subscriptions?.length || 0);

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: 'No subscriptions found for user'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Send to all registered tokens
        const results = await Promise.all(subscriptions.map(async (sub) => {
            const token = sub.endpoint;

            // Check if it's an FCM token (native Android)
            const isFCMToken = !token.startsWith('ExponentPushToken') && !token.startsWith('https://');

            if (isFCMToken) {
                // Send via FCM Legacy HTTP API
                try {
                    const fcmPayload = {
                        to: token,
                        notification: {
                            title: title,
                            body: body,
                            sound: 'default',
                            click_action: 'OPEN_ACTIVITY',
                        },
                        data: data || {},
                        priority: 'high',
                    };

                    console.log('Sending FCM to token:', token.substring(0, 20) + '...');

                    const response = await fetch(FCM_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `key=${fcmServerKey}`,
                        },
                        body: JSON.stringify(fcmPayload),
                    });

                    const result = await response.json();
                    console.log('FCM response:', JSON.stringify(result));

                    if (result.success === 1) {
                        return { success: true, id: sub.id, type: 'fcm' };
                    } else {
                        // If token is invalid, delete it
                        if (result.failure === 1 && result.results?.[0]?.error === 'NotRegistered') {
                            console.log('Token not registered, deleting:', sub.id);
                            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                        }
                        return { success: false, id: sub.id, type: 'fcm', error: result.results?.[0]?.error };
                    }
                } catch (error) {
                    console.error('FCM error for sub', sub.id, error);
                    return { success: false, id: sub.id, type: 'fcm', error: error.message };
                }
            } else {
                // It's an Expo token
                try {
                    const expoPayload = {
                        to: token,
                        title: title,
                        body: body,
                        data: data || {},
                        sound: 'default',
                        channelId: 'default',
                        priority: 'high',
                        badge: 1
                    };

                    console.log('Sending Expo Push to:', token.substring(0, 20) + '...');

                    const response = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip, deflate',
                        },
                        body: JSON.stringify(expoPayload),
                    });

                    const result = await response.json();
                    console.log('Expo response:', JSON.stringify(result));

                    // Expo API returns 200 even for some errors, check data.status
                    if (result.data?.status === 'ok' || !result.errors) {
                        return { success: true, id: sub.id, type: 'expo' };
                    } else {
                        // Check for specific error to cleanup
                        const details = result.data?.details || result.errors?.[0];
                        if (details?.error === 'DeviceNotRegistered') {
                            console.log('Expo Token not registered, deleting:', sub.id);
                            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                        }
                        return { success: false, id: sub.id, type: 'expo', error: JSON.stringify(result) };
                    }

                } catch (error) {
                    console.error('Expo error for sub', sub.id, error);
                    return { success: false, id: sub.id, type: 'expo', error: error.message };
                }
            }
        }));

        const successCount = results.filter(r => r.success).length;
        console.log('Push results:', successCount, 'of', results.length, 'successful');

        return new Response(JSON.stringify({
            success: successCount > 0,
            sent: successCount,
            total: results.length,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Send push error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
