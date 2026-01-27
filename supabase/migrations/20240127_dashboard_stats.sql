
-- Dashboard Stats Function
create or replace function get_dashboard_stats()
returns json
language plpgsql
security definer
as $$
declare
  total_count integer;
  approved_count integer;
  draft_count integer;
  sent_count integer;
  rejected_count integer;
  currency_stats json;
begin
  select count(*) into total_count from proposals;
  select count(*) into approved_count from proposals where status = 'approved';
  select count(*) into draft_count from proposals where status = 'draft';
  select count(*) into sent_count from proposals where status = 'sent';
  select count(*) into rejected_count from proposals where status in ('rejected', 'cancelled');
  
  select json_object_agg(currency, total_amount) into currency_stats
  from (
    select currency, sum(amount) as total_amount
    from proposals
    where currency is not null
    group by currency
  ) t;

  return json_build_object(
    'total_proposals', total_count,
    'approved_count', approved_count,
    'draft_count', draft_count,
    'pending_count', sent_count,
    'rejected_count', rejected_count,
    'currency_breakdown', coalesce(currency_stats, '{}'::json)
  );
end;
$$;

-- Representative Performance Function
create or replace function get_representative_performance()
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  department text,
  role text,
  is_active boolean,
  total_proposals bigint,
  approved_proposals bigint,
  total_amount numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    r.id,
    r.full_name,
    r.email,
    r.phone,
    r.department,
    r.role,
    r.is_active,
    count(p.id) as total_proposals,
    count(p.id) filter (where p.status = 'approved') as approved_proposals,
    coalesce(sum(p.amount), 0) as total_amount
  from 
    representatives r
  left join 
    proposals p on r.id = p.representative_id
  where
    r.is_active = true
  group by 
    r.id, r.full_name, r.email, r.phone, r.department, r.role, r.is_active
  order by
    r.full_name;
end;
$$;
