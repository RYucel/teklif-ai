# Teklif Yönetim Sistemi (Proposal Management System)

This repository contains the source code for the Proposal Management System, consisting of a specific Web application (Next.js) and a Mobile application (React Native / Expo).

## Project Structure

- `web/`: Next.js Web Application (Admin & Representative Dashboard)
- `mobile/`: Expo React Native Application (Mobile Client for Representatives)
- `supabase/`: Database schema and potential Edge Functions

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo Go (for mobile testing)
- Supabase Account

## Getting Started

### Web Application

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) with your browser.

### Mobile Application

1. Navigate to the `mobile` directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo server:
   ```bash
   npx expo start
   ```
4. Scan the QR code with your phone (using Expo Go) or press `a` for Android Emulator / `i` for iOS Simulator.

## Database Setup

The database schema is located in `supabase/schema.sql`. 
You can run this SQL script in the Supabase SQL Editor to verify the tables and policies.

## AI Integration

This project uses Google Gemini for PDF parsing and Chatbot features. API keys layout will be in `.env.local` (Web) and `.env` (Mobile).
