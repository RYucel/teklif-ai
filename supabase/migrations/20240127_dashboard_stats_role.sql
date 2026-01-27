
-- Dashboard Stats Function (Role Aware)
create or replace function get_dashboard_stats()
returns json
language plpgsql
security definer
as $$
declare
  curr_user_id uuid;
  curr_user_role text;
  is_view_all boolean;
  
  total_count integer;
  approved_count integer;
  draft_count integer;
  sent_count integer;
  rejected_count integer;
  currency_stats json;
begin
  curr_user_id := auth.uid();
  
  -- Get user role
  select role into curr_user_role from representatives where id = curr_user_id;
  
  -- Define who can see EVERYTHING (Sales Manager, Admin, Regional Manager)
  is_view_all := (curr_user_role in ('Satış Müdürü', 'Bölge Sorumlusu', 'Admin') or curr_user_role is null); 
  -- Note: if role is null (maybe regular helper), we default to view all? Or view none?
  -- Let's assume if you are not in the list, you only see yours.
  -- BUT, if curr_user_role is null (user not found in representatives), they might be a super admin?
  -- Safest: If not found, show nothing? Or show all?
  -- Let's stick to: If you are explicitly a 'Müşteri Temsilcisi' or 'Kıdemli Temsilci', you see YOURS. 
  -- Everyone else (Managers) see ALL.
  
  if curr_user_role in ('Müşteri Temsilcisi', 'Kıdemli Temsilci') then
    is_view_all := false;
  else
    is_view_all := true;
  end if;

  select count(*) into total_count from proposals 
  where (is_view_all or representative_id = curr_user_id);

  select count(*) into approved_count from proposals 
  where status = 'approved' and (is_view_all or representative_id = curr_user_id);

  select count(*) into draft_count from proposals 
  where status = 'draft' and (is_view_all or representative_id = curr_user_id);

  select count(*) into sent_count from proposals 
  where status = 'sent' and (is_view_all or representative_id = curr_user_id);

  select count(*) into rejected_count from proposals 
  where status in ('rejected', 'cancelled') and (is_view_all or representative_id = curr_user_id);
  
  select json_object_agg(currency, total_amount) into currency_stats
  from (
    select currency, sum(amount) as total_amount
    from proposals
    where currency is not null
      and (is_view_all or representative_id = curr_user_id)
    group by currency
  ) t;

  return json_build_object(
    'total_proposals', total_count,
    'approved_count', approved_count,
    'draft_count', draft_count,
    'pending_count', sent_count,
    'rejected_count', rejected_count,
    'currency_breakdown', coalesce(currency_stats, '{}'::json),
    'is_view_all', is_view_all -- Helpful for UI to know
  );
end;
$$;
