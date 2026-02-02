import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing environment variables: GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    }

    try {
        const body = await req.json().catch(() => null);

        if (!body) {
            throw new Error("Invalid structure: Body is missing.");
        }

        let { file_base64, file_type, file_path } = body;

        // If file_path is provided, download from Storage
        if (file_path) {
            console.log(`Downloading file from storage: ${file_path}`);
            const { data: fileBlob, error: downloadError } = await supabase.storage
                .from('proposals')
                .download(file_path);

            if (downloadError) {
                console.error("Storage download error:", downloadError);
                throw new Error(`Dosya indirilemedi: ${downloadError.message}`);
            }

            if (!fileBlob) {
                throw new Error("Dosya içeriği boş.");
            }

            // Determine mime type from blob if not provided
            if (!file_type) file_type = fileBlob.type || "application/pdf";

            // Convert Blob to Base64
            const arrayBuffer = await fileBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            file_base64 = btoa(binary);
        }

        if (!file_base64) {
            throw new Error("Dosya içeriği bulunamadı (file_base64 veya file_path eksik).");
        }

        const prompt = `
      You are a specialized AI for parsing business proposals (Teklif).
      Extract the following information from the attached proposal document and return ONLY a valid JSON object.
      Do not include markdown formatting or code blocks.

      **Document Structure Hint:**
      - **Header:** Contains standardized info like Representative Name, Customer Name, Job Description.
      - **Footer/Bottom Section:** The 'Total Amount' (Toplam Tutar) is ALWAYS located near the bottom of the document.
      - If you see a table, the final total is usually at the end.

      **Fields to extract:**
      - customer_name (string): Name of the client/customer found in the header (Kime / To).
      - representative_name (string): STRICTLY extract from the field labeled "Müşteri Temsilcisi". Do NOT use the name in "Hazırlayan".
      - offer_date (YYYY-MM-DD): Date of the proposal (Tarih).
      - total_amount (number): The final total monetary value found at the bottom. Ignore subtotals.
      - currency (TRY, USD, EUR): Currency of the total amount.
      - work_description (string): A summary of the work description found in the header (Proje Konusu).
      - department_prediction (string): Predict category either '01-Havuz' or '02-Solar' based on keywords (e.g., 'pool', 'havuz', 'solar', 'panel').
      
      If a field is missing, use null.
    `;


        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: file_type || "application/pdf",
                                data: file_base64
                            }
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new Error(`Gemini AI Hatası: ${data.error.message}`);
        }

        const candidate = data.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;

        if (!textResponse) {
            console.error("Empty response from Gemini:", JSON.stringify(data));
            throw new Error("Yapay zeka geçerli bir yanıt döndüremedi.");
        }

        // Clean JSON
        const jsonStart = textResponse.indexOf('{');
        const jsonEnd = textResponse.lastIndexOf('}') + 1;
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("Yapay zeka yanıtı geçerli JSON formatında değil.");
        }
        const jsonString = textResponse.substring(jsonStart, jsonEnd);

        const parsedData = JSON.parse(jsonString);

        return new Response(JSON.stringify(parsedData), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error: any) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
});
