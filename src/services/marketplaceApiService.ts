import { createSupabaseRestClient } from "./supabaseRest";
import { isDemoDataMode } from "./dataService";
import { marketplaceDemo } from "./marketplaceDemoService";
import { getSupabaseUserId } from "./supabaseAuthService";

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

export interface JobPostInterest {
  id: string;
  job_post_id: string;
  status: "pending" | "selected" | "not_selected" | "withdrawn";
  created_at: string;
}

// Every export here is declared `async` on purpose: createSupabaseRestClient()
// throws synchronously when Supabase isn't configured (demo mode / missing
// env vars). Calling it outside an async function let that throw escape any
// caller's `.catch()` as an uncaught exception instead of a rejected
// promise, which crashed the whole app (no ErrorBoundary catches it either).
// `async` wraps that synchronous throw into a normal rejected promise.
export const loadOpenJobPosts = async (signal?: AbortSignal) => {
  if (isDemoDataMode) return marketplaceDemo.loadOpenJobPosts() as JobPost[];
  return createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    status: "eq.open",
    order: "created_at.desc",
    limit: 20,
  }, { signal });
};

export const loadMyJobPosts = async (signal?: AbortSignal) => {
  if (isDemoDataMode) return marketplaceDemo.loadMyJobPosts() as JobPost[];
  const userId = getSupabaseUserId();
  if (!userId) return [];
  return createSupabaseRestClient().select<JobPost>("job_posts", {
    select: "*",
    client_id: `eq.${userId}`,
    order: "created_at.desc",
  }, { signal });
};

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
  if (isDemoDataMode) {
    return marketplaceDemo.createJobPost({
      title: input.title,
      profession_name: input.professionName,
      city: input.city,
      area_label: input.areaLabel || null,
      description: input.description,
      budget_min: input.budgetMin || null,
      budget_max: input.budgetMax || null,
      preferred_date: input.preferredDate || null,
      photo_url: input.photoUrls?.[0] || null,
      photo_urls: input.photoUrls || [],
    }) as JobPost;
  }
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

export const cancelMyJobPost = async (jobPostId: string) => {
  if (isDemoDataMode) return marketplaceDemo.cancelJobPost(jobPostId) as JobPost;
  return createSupabaseRestClient().rpc<JobPost>("cancel_my_job_post", { p_job_post_id: jobPostId });
};

export const expressInterest = async (jobPostId: string, message: string, estimateMin?: number) => {
  if (isDemoDataMode) return marketplaceDemo.expressInterest(jobPostId);
  return createSupabaseRestClient().rpc<JobPostInterest>("express_interest_in_job_post", {
    p_job_post_id: jobPostId,
    p_message: message || null,
    p_estimate_min: estimateMin || null,
    p_estimate_max: null,
  });
};

export const loadCurrentWorkerJobPostInterests = async (signal?: AbortSignal) => {
  if (isDemoDataMode) return marketplaceDemo.loadCurrentWorkerInterests() as JobPostInterest[];
  return createSupabaseRestClient().select<JobPostInterest>("job_post_interests", {
    select: "id,job_post_id,status,created_at",
    order: "created_at.desc",
  }, { signal });
};

export const withdrawInterestInJobPost = async (interestId: string) => {
  if (isDemoDataMode) return marketplaceDemo.withdrawInterest(interestId) as JobPostInterest;
  const rows = await createSupabaseRestClient().update<JobPostInterest>("job_post_interests", { status: "withdrawn" }, { id: `eq.${interestId}` });
  if (!rows[0]) throw new Error("ინტერესის გაუქმება ვერ მოხერხდა.");
  return rows[0];
};

export const loadWorkerPortfolio = async (workerId: string, signal?: AbortSignal) => {
  if (isDemoDataMode) return marketplaceDemo.loadPortfolio() as PortfolioItem[];
  return createSupabaseRestClient().select<PortfolioItem>("worker_portfolio_items", {
    select: "*",
    worker_id: `eq.${workerId}`,
    is_visible: "eq.true",
    order: "created_at.desc",
    limit: 15,
  }, { signal });
};

export const createCurrentWorkerPortfolioItem = async (imageUrl: string, professionName?: string, description?: string) => {
  if (isDemoDataMode) return marketplaceDemo.createPortfolioItem(imageUrl, professionName, description) as PortfolioItem;
  return createSupabaseRestClient().rpc<PortfolioItem>("add_current_worker_portfolio_item", {
    p_image_url: imageUrl,
    p_profession_name: professionName || null,
    p_description: description || null,
  });
};

export const removePortfolioItem = async (itemId: string) => {
  if (isDemoDataMode) return marketplaceDemo.removePortfolioItem(itemId);
  return createSupabaseRestClient().remove("worker_portfolio_items", { id: `eq.${itemId}` });
};

export const getReferralCode = async () => {
  if (isDemoDataMode) return marketplaceDemo.getReferralCode();
  return createSupabaseRestClient().rpc<string>("get_or_create_referral_code", {});
};

export const applyReferralCode = async (code: string) => {
  if (isDemoDataMode) return marketplaceDemo.applyReferralCode(code);
  return createSupabaseRestClient().rpc<{ ok: boolean; message: string }>("apply_referral_code", { p_code: code });
};
