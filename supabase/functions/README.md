# Supabase Edge Functions for Teklif AI

This directory contains the server-side logic for AI operations, powered by Deno and Google Gemini.

## Functions

### 1. `parse-proposal`
- **Purpose**: Parses a PDF file (sent as base64) to extract proposal details using Gemini 2.0 Flash (Multimodal).
- **Input**:
  ```json
  {
    "file_base64": "JVBERi...",
    "file_type": "application/pdf"
  }
  ```
- **Output**: JSON object with fields like `customer_name`, `total_amount`, `department_prediction`.

### 2. `chat-query`
- **Purpose**: Converts natural language questions from users into database queries or answers.
- **Input**:
  ```json
  {
    "query": "Show me approved proposals",
    "user_id": "uuid",
    "user_role": "admin|representative"
  }
  ```
- **Output**: JSON with `reply` and `data`.

### 3. `check-reminders`
- **Purpose**: Scheduled task to check for stalled proposals (>5 days) and create notifications.
- **Trigger**: Cron job or manual invocation.
- **Output**: JSON with `processed_count`.

## Deployment

To deploy these functions to your Supabase project:

1. Login to Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Deploy functions:
   ```bash
   npx supabase functions deploy parse-proposal --no-verify-jwt
   npx supabase functions deploy chat-query --no-verify-jwt
   npx supabase functions deploy check-reminders --no-verify-jwt
   ```
3. Set Secrets:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   ```
