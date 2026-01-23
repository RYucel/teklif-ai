import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Hardcoded configuration for stability (Confirmed working pattern)
const GEMINI_API_KEY = "AIzaSyDzfERPLL25UDms-RMhvOl8ssnD31ix9Q8";
const SUPABASE_URL = "https://xjmgwfcveqvumykjvrtj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbWd3ZmN2ZXF2dW15a2p2cnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5Njg2MTIsImV4cCI6MjA4NDU0NDYxMn0.2NH5wsHFV3tMWa9lzKWEQszy1mgT4ZyAVbrX5y7IWEY";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent";

const SYSTEM_INSTRUCTION = `
You are a database assistant for a Proposal Management System.
Your job is to convert natural language queries into specific parameters for a database query or explain the data.
Current User ID is provided. Filter by representative_id if user asks about 'my' proposals.
Return JSON with intent: 'query_proposals', 'aggregation', 'general_chat'.

Aggregations:
- type: 'count', 'sum', 'avg'
- field: 'amount'
- group_by: 'status', 'customer_name', 'department_code', 'representative_id'

Generic Date Ranges (calculate start_date based on today):
- 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'last_year', 'last_7_days', 'last_30_days', 'last_3_months', 'last_6_months'
`;

serve(async (req) => {
    // CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
            }
        });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { query, user_id, user_role } = body;

        // Initialize Supabase with User Context
        const authHeader = req.headers.get('Authorization');
        const clientOptions = authHeader ? {
            global: { headers: { Authorization: authHeader } }
        } : {};

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);

        if (!query) {
            return new Response(JSON.stringify({ reply: "Hello! System is online. Ask me about your proposals." }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                status: 200
            });
        }

        // Call Gemini
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `User Query: "${query}"\nUser Role: ${user_role}\nUser ID: ${user_id}\n\n${SYSTEM_INSTRUCTION}` }]
                }]
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API Error: ${geminiResponse.statusText}`);
        }

        const geminiData = await geminiResponse.json();
        const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        // Parse JSON intent
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return new Response(JSON.stringify({ reply: textResponse, meta: "No JSON intent found" }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                status: 200
            });
        }

        const intentData = JSON.parse(jsonMatch[0]);

        // Execute DB Query
        if (intentData.intent === 'query_proposals' || intentData.intent === 'aggregation') {
            let dbQuery = supabase.from('proposals').select('*');

            // Apply filters
            const filters = intentData.filters || {};
            if (filters.status) dbQuery = dbQuery.eq('status', filters.status);
            if (filters.department_code) dbQuery = dbQuery.eq('department_code', filters.department_code);
            if (filters.representative_id === 'CURRENT_USER_ID') dbQuery = dbQuery.eq('representative_id', user_id);
            if (filters.customer_name) dbQuery = dbQuery.ilike('customer_name', `%${filters.customer_name}%`);

            // Helper to get date dateRange
            const getDateFilter = (range: string) => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                switch (range) {
                    case 'today': return { start: today.toISOString(), end: now.toISOString() };
                    case 'yesterday':
                        const y = new Date(today); y.setDate(y.getDate() - 1);
                        return { start: y.toISOString(), end: today.toISOString() };
                    case 'last_7_days':
                        const d7 = new Date(today); d7.setDate(d7.getDate() - 7);
                        return { start: d7.toISOString(), end: now.toISOString() };
                    case 'last_30_days':
                        const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
                        return { start: d30.toISOString(), end: now.toISOString() };
                    case 'this_month':
                        const m1 = new Date(now.getFullYear(), now.getMonth(), 1);
                        return { start: m1.toISOString(), end: now.toISOString() };
                    case 'last_month':
                        const m2_start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const m2_end = new Date(now.getFullYear(), now.getMonth(), 0);
                        return { start: m2_start.toISOString(), end: m2_end.toISOString() };
                    case 'this_year':
                        const y1 = new Date(now.getFullYear(), 0, 1);
                        return { start: y1.toISOString(), end: now.toISOString() };
                    default: return null;
                }
            };

            if (filters.date_range) {
                const dates = getDateFilter(filters.date_range);
                if (dates) {
                    dbQuery = dbQuery.gte('created_at', dates.start).lte('created_at', dates.end);
                }
            }

            const { data, error } = await dbQuery;

            if (error) {
                console.error("DB Error", error);
                throw error;
            }

            // Calculate Summary
            let summary = null;
            let reply = `Found ${data.length} records.`;

            if (intentData.intent === 'aggregation') {
                if (intentData.type === 'sum') {
                    const total = data.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                    summary = {
                        type: 'sum',
                        value: total,
                        label: 'Total Amount',
                        currency: 'TRY'
                    };
                    reply = `Total amount is ${total.toLocaleString('tr-TR')} TRY.`;
                } else if (intentData.type === 'count') {
                    summary = {
                        type: 'count',
                        value: data.length,
                        label: 'Total Count'
                    };
                    reply = `Found ${data.length} proposals.`;
                }
            }

            return new Response(JSON.stringify({
                reply: reply,
                data: data,
                summary: summary,
                meta: intentData
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                status: 200
            });
        }

        return new Response(JSON.stringify({ reply: "I understood but no action taken.", meta: intentData }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            status: 200
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: "Function Error",
            message: error.message
        }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            status: 200 // Always return 200 to show error in frontend
        });
    }
});
