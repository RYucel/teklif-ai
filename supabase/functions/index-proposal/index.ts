import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing environment variables");
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const EMBEDDING_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body) throw new Error("Invalid JSON body");

        const { proposal_id } = body;
        if (!proposal_id) throw new Error("Missing proposal_id");

        console.log(`Indexing proposal: ${proposal_id}`);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch Proposal Info
        const { data: proposal, error: fetchError } = await supabase
            .from('proposals')
            .select('pdf_url, proposal_no, customer_name, representative_name')
            .eq('id', proposal_id)
            .single();

        if (fetchError || !proposal) throw new Error("Proposal not found");
        if (!proposal.pdf_url) throw new Error("Proposal has no PDF file attached");

        console.log(`PDF Path: ${proposal.pdf_url}`);

        // 2. Download PDF
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('proposals')
            .download(proposal.pdf_url);

        if (downloadError) throw new Error(`Failed to download PDF: ${downloadError.message}`);

        // Convert to Base64 for Gemini
        const arrayBuffer = await fileData.arrayBuffer();
        const base64Bytes = new Uint8Array(arrayBuffer);
        const base64String = btoa(String.fromCharCode(...base64Bytes));

        // 3. Extract Text via Gemini 2.0 Flash
        const prompt = `
            Extract all text content from this business proposal document. 
            Return the text in plain text format, preserving meaningful structure. 
            Include details like item descriptions, quantities, prices, technical specifications, and terms.
        `;

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "application/pdf", data: base64String } }
                    ]
                }]
            })
        });

        const data = await response.json();
        const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!extractedText) throw new Error("Failed to extract text from PDF");

        console.log("Text extracted. Length:", extractedText.length);

        // 4. Generate Embedding for the ENTIRE text (or consider chunking if too large)
        // Gemini embedding limit is 2048 tokens. For larger docs, we might need to chunk.
        // For now, let's assume proposals fit or truncate.
        // Actually, let's split into chunks of ~1500 chars to be safe/granular.

        const chunks = extractedText.match(/.{1,1500}/g) || [extractedText];
        console.log(`Split into ${chunks.length} chunks`);

        for (const chunk of chunks) {
            const embeddingResponse = await fetch(`${EMBEDDING_API_URL}?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: { parts: [{ text: chunk }] }
                })
            });

            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.embedding?.values;

            if (!embedding) {
                console.error("Embedding generation failed for chunk", embeddingData);
                continue;
            }

            // 5. Save to proposal_embeddings
            const { error: insertError } = await supabase
                .from('proposal_embeddings')
                .insert({
                    proposal_id: proposal_id,
                    content: chunk,
                    embedding: embedding,
                    metadata: {
                        proposal_no: proposal.proposal_no,
                        customer: proposal.customer_name,
                        rep: proposal.representative_name
                    }
                });

            if (insertError) {
                console.error("Embedding insert error:", insertError);
            }
        }

        return new Response(JSON.stringify({ success: true, chunks: chunks.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Index Proposal Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
