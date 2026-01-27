
-- Fix notifications FK to allow proposal deletion
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_proposal_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_proposal_id_fkey
FOREIGN KEY (proposal_id)
REFERENCES public.proposals(id)
ON DELETE CASCADE;

-- Fix follow_up_logs FK to allow proposal deletion
ALTER TABLE public.follow_up_logs
DROP CONSTRAINT IF EXISTS follow_up_logs_proposal_id_fkey;

ALTER TABLE public.follow_up_logs
ADD CONSTRAINT follow_up_logs_proposal_id_fkey
FOREIGN KEY (proposal_id)
REFERENCES public.proposals(id)
ON DELETE CASCADE;
