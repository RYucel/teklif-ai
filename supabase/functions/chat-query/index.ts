import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYSTEM_INSTRUCTION = `
You are a database assistant for a Proposal Management System.
Your job is to convert natural language queries into specific parameters for a database query or explain the data.

Database Schema:
- Table: proposals
- Columns: id, proposal_no, customer_name, status (draft, sent, approved, revised, cancelled, rejected), amount, currency, usd_amount, offer_date, representative_id

Current User ID is provided in the context. If the user asks about "my proposals", filter by representative_id.

Return a JSON with identifying the intent and parameters.
Possible intents: 'query_proposals', 'aggregation', 'general_chat'

Example Output for "Show me my approved proposals":
{
  "intent": "query_proposals",
  "filters": {
    "status": "approved",
    "representative_id": "CURRENT_USER_ID"
  }
}
`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    }

    try {
        const { query, user_id, user_role } = await req.json();

        // 1. Ask Gemini to interpret the query
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `User Query: "${query}"\nUser Role: ${user_role}\nUser ID: ${user_id}\n\n${SYSTEM_INSTRUCTION}` }]
                }]
            })
        });

        const geminiData = await geminiResponse.json();
        const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        // Simple JSON extraction
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return new Response(JSON.stringify({ message: textResponse }), { headers: { "Content-Type": "application/json" } });
        }

        const intentData = JSON.parse(jsonMatch[0]);

        if (intentData.intent === 'query_proposals') {
            let dbQuery = supabase.from('proposals').select('*');

            // Apply dynamic filters
            const filters = intentData.filters || {};
            if (filters.status) dbQuery = dbQuery.eq('status', filters.status);
            if (filters.representative_id === 'CURRENT_USER_ID') dbQuery = dbQuery.eq('representative_id', user_id);

            const { data, error } = await dbQuery;

            return new Response(JSON.stringify({
                reply: `Found ${data?.length} proposals matching your criteria.`,
                data: data,
                meta: intentData
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        return new Response(JSON.stringify({ reply: "I understood the intent but logic is limited in this demo.", meta: intentData }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
});
