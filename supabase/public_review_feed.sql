-- Safe public review feed for a craftsman's profile.
-- It deliberately omits reviewer identity, booking details, phone numbers, and addresses.
create or replace function public.get_worker_public_reviews(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_user_id uuid;
begin
  select user_id
  into worker_user_id
  from public.workers
  where id = p_worker_id
    and verification_status = 'verified';

  if worker_user_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', reviews.id,
          'overall', reviews.overall_rating,
          'criteria', reviews.criteria_json,
          'comment', reviews.comment,
          'createdAt', reviews.created_at
        )
        order by reviews.created_at desc
      )
      from (
        select id, overall_rating, criteria_json, comment, created_at
        from public.reviews
        where reviewee_id = worker_user_id
          and reviewee_role = 'craftsman'
        order by created_at desc
        limit 20
      ) as reviews
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_worker_public_reviews(uuid) to authenticated;
