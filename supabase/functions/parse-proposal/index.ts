import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = "AIzaSyD7nsm5Ba_QEhTqsC4ln8FQZlkK92ZC8bE";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    }

    try {
        const body = await req.json().catch(() => null);

        if (!body) {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 200, // Return 200 so client can read the error message
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        const { file_base64, file_type } = body;

        if (!file_base64) {
            return new Response(JSON.stringify({ error: "No file content provided (file_base64 missing)" }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        // Check file size (base64 adds ~33% overhead, so 10MB file = ~13MB base64)
        if (file_base64.length > 15000000) {
            return new Response(JSON.stringify({ error: "Dosya çok büyük. Maksimum 10MB desteklenir." }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
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
            throw new Error(data.error.message);
        }

        const candidate = data.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;

        if (!textResponse) {
            console.error("Gemini Validation Failed. Full Response:", JSON.stringify(data));
            // Check for safety ratings blocking the content
            const safetyRatings = candidate?.safetyRatings;
            if (safetyRatings) {
                const dropped = safetyRatings.find((r: any) => r.probability !== "NEGLIGIBLE");
                if (dropped) {
                    throw new Error(`AI Güvenlik Filtresi: İçerik engellendi (${dropped.category}).`);
                }
            }
            throw new Error("Yapay zeka geçerli bir yanıt döndüremedi. (Boş yanıt)");
        }

        const jsonStart = textResponse.indexOf('{');
        const jsonEnd = textResponse.lastIndexOf('}') + 1;
        const jsonString = textResponse.substring(jsonStart, jsonEnd);

        const parsedData = JSON.parse(jsonString);

        return new Response(JSON.stringify(parsedData), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
});
