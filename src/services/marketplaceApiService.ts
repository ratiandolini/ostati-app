import { createSupabaseRestClient } from "./supabaseRest";

export interface JobPost {
  id: string;
  title: string;
  profession_name: string;
  city: string;
  area_label?: string | null;
  description: string;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  preferred_date?: string | null;
  status: "open" | "selected" | "closed" | "cancelled";
  selected_worker_id?: string | null;
  interest_limit: number;
  created_at: string;
}

export interface PortfolioItem {
  id: string;
  worker_id: string;
  image_url: string;
  profession_name?: string | null;
  description?: string | null;
  is_visible: boolean;
  created_at: string;
}

// Every export here is declared `async` on purpose: createSupabaseRestClient()
// throws synchronously when Supabase isn't configured (demo mode / missing
// env vars). Calling it outside an async function let that throw escape any
// caller's `.catch()` as an uncaught exception instead of a rejected
// promise, which crashed the whole app (no ErrorBoundary catches it either).
// `async` wraps that synchronous throw into a normal rejected promise.
export const loadOpenJobPosts = async (signal?: AbortSignal) =>
  createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    status: "eq.open",
    order: "created_at.desc",
    limit: 20,
  }, { signal });

export const loadMyJobPosts = async (signal?: AbortSignal) =>
  createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    order: "created_at.desc",
  }, { signal });

export const createJobPost = async (input: {
  title: string;
  professionName: string;
  city: string;
  areaLabel?: string;
  description: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredDate?: string | null;
  photoUrls?: string[];
}) => {
  const client = createSupabaseRestClient();
  const post = await client.rpc<JobPost>("create_job_post", {
    p_title: input.title,
    p_profession_name: input.professionName,
    p_city: input.city,
    p_area_label: input.areaLabel || null,
    p_description: input.description,
    p_budget_min: input.budgetMin || null,
    p_budget_max: input.budgetMax || null,
    p_preferred_date: input.preferredDate || null,
  });
  if (!input.photoUrls?.length) return post;
  const updated = await client.update<JobPost>("job_posts", {
    photo_url: input.photoUrls[0],
    photo_urls: input.photoUrls,
  }, { id: `eq.${post.id}` });
  return updated[0] || { ...post, photo_url: input.photoUrls[0], photo_urls: input.photoUrls };
};

export const cancelMyJobPost = async (jobPostId: string) =>
  createSupabaseRestClient().rpc<JobPost>("cancel_my_job_post", { p_job_post_id: jobPostId });

export const expressInterest = async (jobPostId: string, message: string, estimateMin?: number) =>
  createSupabaseRestClient().rpc("express_interest_in_job_post", {
    p_job_post_id: jobPostId,
    p_message: message || null,
    p_estimate_min: estimateMin || null,
    p_estimate_max: null,
  });

export const loadWorkerPortfolio = async (workerId: string, signal?: AbortSignal) =>
  createSupabaseRestClient().select<PortfolioItem>("worker_portfolio_items", {
    select: "*",
    worker_id: `eq.${workerId}`,
    is_visible: "eq.true",
    order: "created_at.desc",
    limit: 15,
  }, { signal });

export const createCurrentWorkerPortfolioItem = async (imageUrl: string, professionName?: string, description?: string) =>
  createSupabaseRestClient().rpc<PortfolioItem>("add_current_worker_portfolio_item", {
    p_image_url: imageUrl,
    p_profession_name: professionName || null,
    p_description: description || null,
  });

export const removePortfolioItem = async (itemId: string) =>
  createSupabaseRestClient().remove("worker_portfolio_items", { id: `eq.${itemId}` });

export const getReferralCode = async () =>
  createSupabaseRestClient().rpc<string>("get_or_create_referral_code", {});

export const applyReferralCode = async (code: string) =>
  createSupabaseRestClient().rpc<{ ok: boolean; message: string }>("apply_referral_code", { p_code: code });
