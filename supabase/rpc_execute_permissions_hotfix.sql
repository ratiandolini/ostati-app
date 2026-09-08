-- FIXART production RPC execute-permission hotfix.
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. An explicit grant to
-- authenticated does not remove that inherited access from anon. Start by
-- removing the default public grant from every application function, then
-- restore access deliberately by role.

-- 1. No application RPC is callable through the public default role.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- 2. Authenticated browser flows use Supabase's authenticated role. Their
-- own function-level ownership and admin checks remain the authorization
-- boundary for their existing product actions.
grant execute on all functions in schema public to authenticated;

-- 3. These are the only intentionally anonymous, read-only marketplace RPCs.
grant execute on function public.get_public_worker_cards() to anon;
grant execute on function public.get_worker_public_reviews(uuid) to anon;
grant execute on function public.get_public_app_settings() to anon;

-- 4. Internal trigger, notification, subscription, payment and workflow
-- helpers must not be callable directly by an authenticated browser session.
-- They are still callable by their owning SECURITY DEFINER functions/triggers
-- and by service_role for operational work.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'notify_user',
        'notify_booking_status_change',
        'notify_dispute_change',
        'audit_booking_cancellation',
        'booking_status_body',
        'booking_status_title',
        'is_allowed_booking_status_transition',
        'validate_booking_status_transition',
        'booking_worker_user_id',
        'sync_booking_status_from_dispute',
        'platform_fee_rate',
        'calculate_platform_fee',
        'prepare_payment_amounts',
        'sync_booking_payment_status',
        'mark_payment_timestamps',
        'default_trial_days',
        'default_monthly_subscription_amount',
        'ensure_worker_trial_started',
        'create_worker_trial_subscription',
        'sync_worker_subscription_status',
        'refresh_expired_worker_trials',
        'create_trial_expiry_notifications',
        'run_subscription_maintenance',
        'sync_subscription_from_platform_settings',
        'worker_can_receive_bookings',
        'user_can_review_booking',
        'validate_review_participants',
        'recalculate_user_rating',
        'refresh_reviewee_rating',
        'set_updated_at',
        'handle_new_auth_user',
        'current_admin_has_permission'
      ])
  loop
    execute format('revoke execute on function %s from authenticated', function_signature);
  end loop;
end
$$;

-- notify_user is an internal helper with no caller ownership check. Keep this
-- explicit assertion close to the audit finding so it cannot be re-exposed by
-- a later broad authenticated grant.
revoke execute on function public.notify_user(uuid, uuid, text, text, text)
  from anon, authenticated, public;

-- Classification:
--   intentionally public: get_public_worker_cards, get_worker_public_reviews,
--     get_public_app_settings (anon + authenticated)
--   authenticated-only: client/craftsman/admin product RPCs (authenticated)
--   internal/service-only: the helpers revoked above (service_role/owners only)
