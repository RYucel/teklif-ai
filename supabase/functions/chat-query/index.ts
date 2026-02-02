import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Hardcoded configuration for stability
const GEMINI_API_KEY = "AIzaSyDzfERPLL25UDms-RMhvOl8ssnD31ix9Q8";
const SUPABASE_URL = "https://xjmgwfcveqvumykjvrtj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbWd3ZmN2ZXF2dW15a2p2cnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5Njg2MTIsImV4cCI6MjA4NDU0NDYxMn0.2NH5wsHFV3tMWa9lzKWEQszy1mgT4ZyAVbrX5y7IWEY";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const EMBEDDING_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const SYSTEM_INSTRUCTION = `
You are a smart assistant for a Proposal Management System.
Your job is to classify the user's intent and extract parameters.

Intents:
1. 'rag_query': Questions about the CONTENT of proposals (e.g., "What did we offer to X?", "Does Y proposal include server maintenance?", "List items in proposal 123").
2. 'query_proposals': Questions about METADATA or LISTING (e.g., "Show me proposals from last month", "List approved proposals").
3. 'aggregation': Questions requiring CALCULATION (e.g., "Total sales amount", "Count of rejected proposals").
4. 'general_chat': Greetings or irrelevant questions.

Current User ID is provided. Filter by representative_id if user asks about 'my' proposals.

Return JSON ONLY:
{
  "intent": "rag_query" | "query_proposals" | "aggregation" | "general_chat",
  "query": "refined query for search if needed",
  "filters": {
    "status": "...",
    "customer_name": "...",
    "date_range": "today" | "last_month" | ...
  },
  "type": "sum" | "count" | "avg" (only for aggregation)
}
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

        // Initialize Supabase
        const authHeader = req.headers.get('Authorization');
        const clientOptions = authHeader ? {
            global: { headers: { Authorization: authHeader } }
        } : {};
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);

        if (!query) {
            return new Response(JSON.stringify({ reply: "Hello! Ask me about your proposals." }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                status: 200
            });
        }

        // 1. Determine Intent with Gemini
        const intentResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `User Query: "${query}"\nUser Role: ${user_role}\nUser ID: ${user_id}\n\n${SYSTEM_INSTRUCTION}` }]
                }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const intentDataRaw = await intentResponse.json();
        const intentJsonStr = intentDataRaw.candidates?.[0]?.content?.parts?.[0]?.text;
        const intentData = JSON.parse(intentJsonStr || "{}");

        console.log("Intent:", intentData);

        // 2. Handle RAG Query (Semantic Search)
        if (intentData.intent === 'rag_query') {
            console.log("Executing RAG Search...");

            // A. Generate Embedding for Query
            const embeddingResponse = await fetch(`${EMBEDDING_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: { parts: [{ text: intentData.query || query }] }
                })
            });

            const embeddingJson = await embeddingResponse.json();
            const queryEmbedding = embeddingJson.embedding?.values;

            if (!queryEmbedding) {
                throw new Error("Failed to generate embedding for query");
            }

            // B. Search Vector DB via RPC
            const { data: chunks, error: rpcError } = await supabase.rpc('match_proposal_embeddings', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5, // Sensitivity
                match_count: 5,       // Top 5 chunks
                filter_representative_id: null // Can restrict to own proposals if needed
            });

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                throw rpcError;
            }

            console.log(`Found ${chunks?.length || 0} chunks`);

            // C. Generate Answer with Context
            const contextText = chunks?.map((c: any) => `[Proposal for ${c.metadata?.customer}]: ${c.content}`).join("\n\n") || "No relevant documents found.";

            const answerPrompt = `
                You are a helpful assistant. Answer the user's question based ONLY on the following context.
                If the answer is not in the context, say "I couldn't find that information in the proposals."
                
                Context:
                ${contextText}
                
                Question: ${query}
            `;

            const answerResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: answerPrompt }] }]
                })
            });

            const answerData = await answerResponse.json();
            const finalAnswer = answerData.candidates?.[0]?.content?.parts?.[0]?.text;

            return new Response(JSON.stringify({
                reply: finalAnswer,
                intent: 'rag_query',
                sources: chunks?.map((c: any) => c.metadata?.customer)
            }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                status: 200
            });
        }

        // 3. Handle SQL / Aggregation Query (Existing Logic)
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

        // 4. Fallback / General Chat
        return new Response(JSON.stringify({
            reply: "I am ready to help with your proposals. You can ask about details inside them or get summary statistics.",
            meta: intentData
        }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            status: 200
        });

    } catch (error) {
        console.error("Function Error:", error);
        return new Response(JSON.stringify({
            error: "Function Error",
            message: error.message
        }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            status: 200
        });
    }
});
