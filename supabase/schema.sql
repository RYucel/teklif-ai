-- Teklif Yönetim Sistemi SQL Şeması
-- Supabase / PostgreSQL

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'representative');
CREATE TYPE proposal_status AS ENUM ('draft', 'sent', 'approved', 'revised', 'cancelled', 'rejected');
CREATE TYPE currency_type AS ENUM ('TRY', 'USD', 'EUR');
CREATE TYPE notification_type AS ENUM ('reminder', 'status_change', 'system');

-- 2. TABLES

-- Profiles (Extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role user_role DEFAULT 'representative',
    department TEXT, -- Temsilcinin bölümü (Opsiyonel)
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Proposals
CREATE TABLE public.proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_no TEXT UNIQUE NOT NULL, -- Format: 01-001
    department_code TEXT NOT NULL, -- Örn: 01, 02
    department_seq INTEGER NOT NULL, -- Sıra no
    revision_no INTEGER DEFAULT 0,
    status proposal_status DEFAULT 'draft',
    customer_name TEXT NOT NULL,
    customer_contact TEXT,
    representative_id UUID REFERENCES public.profiles(id),
    work_description TEXT,
    amount NUMERIC,
    currency currency_type DEFAULT 'TRY',
    usd_rate NUMERIC, -- Teklif tarihindeki kur
    usd_amount NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN currency = 'USD' THEN amount
            WHEN usd_rate > 0 THEN amount / usd_rate
            ELSE 0 
        END
    ) STORED,
    offer_date DATE DEFAULT CURRENT_DATE,
    validity_days INTEGER DEFAULT 30,
    pdf_url TEXT,
    raw_ai_data JSONB, -- AI'dan gelen ham veri
    last_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Proposals
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Admin her şeyi görür
CREATE POLICY "Admins can view all proposals" 
ON public.proposals FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Temsilci sadece kendi tekliflerini görür
CREATE POLICY "Representatives can view own proposals" 
ON public.proposals FOR SELECT 
USING (
  representative_id = auth.uid()
);

-- Admin her şeyi düzenleyebilir
CREATE POLICY "Admins can update all proposals" 
ON public.proposals FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Temsilci kendi teklifini düzenleyebilir
CREATE POLICY "Representatives can update own proposals" 
ON public.proposals FOR UPDATE 
USING (
  representative_id = auth.uid()
);

-- Insert policy (Herkes teklif oluşturabilir ama representative_id kendine atanmalı varsa)
CREATE POLICY "Users can create proposals" 
ON public.proposals FOR INSERT 
WITH CHECK (
   auth.uid() = representative_id OR 
   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- Notifications
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    proposal_id UUID REFERENCES public.proposals(id),
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);


-- Audit Logs
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Sadece admin görebilir
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- 3. FUNCTIONS & TRIGGERS

-- Otomatik Proposal No Üretimi için Fonksiyon
CREATE OR REPLACE FUNCTION public.generate_proposal_no()
RETURNS TRIGGER AS $$
DECLARE
    next_seq INTEGER;
    dept_code TEXT;
BEGIN
    dept_code := NEW.department_code;
    
    -- Bölüme ait en son sıra numarasını bul
    SELECT COALESCE(MAX(department_seq), 0) + 1 
    INTO next_seq 
    FROM public.proposals 
    WHERE department_code = dept_code;

    -- Yeni değerleri ata
    NEW.department_seq := next_seq;
    -- Format: 01-001 (3 haneli padding)
    NEW.proposal_no := dept_code || '-' || LPAD(next_seq::TEXT, 3, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı bağla
CREATE TRIGGER trigger_generate_proposal_no
BEFORE INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.generate_proposal_no();


-- Updated_at alanını otomatik güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_proposals_updated
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Dashboard İstatistikleri için RPC (Remote Procedure Call)
-- Admin tümünü, Temsilci kendisininkini görür
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role user_role;
    v_user_id UUID;
    result JSONB;
BEGIN
    v_user_id := auth.uid();
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role = 'admin' THEN
        SELECT jsonb_build_object(
            'total_proposals', COUNT(*),
            'total_amount_usd', COALESCE(SUM(usd_amount), 0),
            'pending_count', COUNT(*) FILTER (WHERE status IN ('draft', 'sent', 'revised')),
            'approved_count', COUNT(*) FILTER (WHERE status = 'approved')
        ) INTO result
        FROM public.proposals;
    ELSE
        SELECT jsonb_build_object(
            'total_proposals', COUNT(*),
            'total_amount_usd', COALESCE(SUM(usd_amount), 0),
            'pending_count', COUNT(*) FILTER (WHERE status IN ('draft', 'sent', 'revised')),
            'approved_count', COUNT(*) FILTER (WHERE status = 'approved')
        ) INTO result
        FROM public.proposals
        WHERE representative_id = v_user_id;
    END IF;

    RETURN result;
END;
$$;
