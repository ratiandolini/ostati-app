import { createSupabaseRestClient } from "./supabaseRest";

export interface JobPost {
  id: string;
  title: string;
  profession_name: string;
  city: string;
  area_label?: string | null;
  description: string;
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

export const loadOpenJobPosts = (signal?: AbortSignal) =>
  createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    status: "eq.open",
    order: "created_at.desc",
    limit: 20,
  }, { signal });

export const loadMyJobPosts = (signal?: AbortSignal) =>
  createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    order: "created_at.desc",
  }, { signal });

export const createJobPost = (input: {
  title: string;
  professionName: string;
  city: string;
  areaLabel?: string;
  description: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredDate?: string | null;
}) => createSupabaseRestClient().rpc<JobPost>("create_job_post", {
  p_title: input.title,
  p_profession_name: input.professionName,
  p_city: input.city,
  p_area_label: input.areaLabel || null,
  p_description: input.description,
  p_budget_min: input.budgetMin || null,
  p_budget_max: input.budgetMax || null,
  p_preferred_date: input.preferredDate || null,
});

export const expressInterest = (jobPostId: string, message: string, estimateMin?: number) =>
  createSupabaseRestClient().rpc("express_interest_in_job_post", {
    p_job_post_id: jobPostId,
    p_message: message || null,
    p_estimate_min: estimateMin || null,
    p_estimate_max: null,
  });

export const loadWorkerPortfolio = (workerId: string, signal?: AbortSignal) =>
  createSupabaseRestClient().select<PortfolioItem>("worker_portfolio_items", {
    select: "*",
    worker_id: `eq.${workerId}`,
    is_visible: "eq.true",
    order: "created_at.desc",
    limit: 15,
  }, { signal });

export const createCurrentWorkerPortfolioItem = (imageUrl: string, professionName?: string, description?: string) =>
  createSupabaseRestClient().rpc<PortfolioItem>("add_current_worker_portfolio_item", {
    p_image_url: imageUrl,
    p_profession_name: professionName || null,
    p_description: description || null,
  });

export const removePortfolioItem = (itemId: string) =>
  createSupabaseRestClient().remove("worker_portfolio_items", { id: `eq.${itemId}` });

export const getReferralCode = () =>
  createSupabaseRestClient().rpc<string>("get_or_create_referral_code", {});

export const applyReferralCode = (code: string) =>
  createSupabaseRestClient().rpc<{ ok: boolean; message: string }>("apply_referral_code", { p_code: code });
