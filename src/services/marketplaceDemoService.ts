type DemoJobPost = {
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
  interested_worker_ids?: string[];
};

type DemoJobPostInterest = {
  id: string;
  job_post_id: string;
  status: "pending" | "selected" | "not_selected" | "withdrawn";
  created_at: string;
};

type DemoPortfolioItem = {
  id: string;
  worker_id: string;
  image_url: string;
  profession_name?: string | null;
  description?: string | null;
  is_visible: boolean;
  created_at: string;
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = <T,>(key: string, value: T) => {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("app-data-updated", { detail: { name: key } }));
};

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const JOB_POSTS_KEY = "demoMarketplaceJobPosts";
const PORTFOLIO_KEY = "demoMarketplacePortfolio";
const REFERRALS_KEY = "demoMarketplaceReferrals";
const INTERESTS_KEY = "demoMarketplaceJobPostInterests";

const referralState = () => read<{ code?: string; appliedCode?: string }>(REFERRALS_KEY, {});

export const marketplaceDemo = {
  loadOpenJobPosts: (): DemoJobPost[] =>
    read<DemoJobPost[]>(JOB_POSTS_KEY, [])
      .filter((post) => post.status === "open")
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),

  loadMyJobPosts: (): DemoJobPost[] =>
    read<DemoJobPost[]>(JOB_POSTS_KEY, []).sort((a, b) => b.created_at.localeCompare(a.created_at)),

  createJobPost(input: Omit<DemoJobPost, "id" | "status" | "interest_limit" | "created_at">): DemoJobPost {
    const post: DemoJobPost = {
      ...input,
      id: id("job"),
      status: "open",
      interest_limit: 5,
      created_at: new Date().toISOString(),
      interested_worker_ids: [],
    };
    write(JOB_POSTS_KEY, [post, ...read<DemoJobPost[]>(JOB_POSTS_KEY, [])]);
    return post;
  },

  cancelJobPost(jobPostId: string): DemoJobPost {
    let updated: DemoJobPost | undefined;
    const next = read<DemoJobPost[]>(JOB_POSTS_KEY, []).map((post) => {
      if (post.id !== jobPostId) return post;
      updated = { ...post, status: "cancelled" };
      return updated;
    });
    if (!updated) throw new Error("მოთხოვნა ვერ მოიძებნა.");
    write(JOB_POSTS_KEY, next);
    return updated;
  },

  expressInterest(jobPostId: string): DemoJobPostInterest {
    const interest: DemoJobPostInterest = { id: id("interest"), job_post_id: jobPostId, status: "pending", created_at: new Date().toISOString() };
    const next = read<DemoJobPost[]>(JOB_POSTS_KEY, []).map((post) => {
      if (post.id !== jobPostId) return post;
      const interested = post.interested_worker_ids || [];
      if (read<DemoJobPostInterest[]>(INTERESTS_KEY, []).some((item) => item.job_post_id === jobPostId && item.status === "pending")) throw new Error("ამ მოთხოვნაზე ინტერესი უკვე გამოგზავნილია.");
      if (interested.length >= post.interest_limit) throw new Error("ამ მოთხოვნაზე საკმარისი ხელოსანი უკვე დაინტერესდა.");
      return { ...post, interested_worker_ids: [...interested, "demo-worker"] };
    });
    write(JOB_POSTS_KEY, next);
    write(INTERESTS_KEY, [interest, ...read<DemoJobPostInterest[]>(INTERESTS_KEY, [])]);
    return interest;
  },

  loadCurrentWorkerInterests: (): DemoJobPostInterest[] => read<DemoJobPostInterest[]>(INTERESTS_KEY, []),

  withdrawInterest(interestId: string): DemoJobPostInterest {
    let updated: DemoJobPostInterest | undefined;
    const next = read<DemoJobPostInterest[]>(INTERESTS_KEY, []).map((item) => {
      if (item.id !== interestId) return item;
      updated = { ...item, status: "withdrawn" };
      return updated;
    });
    if (!updated) throw new Error("ინტერესი ვერ მოიძებნა.");
    write(INTERESTS_KEY, next);
    return updated;
  },

  loadPortfolio: (): DemoPortfolioItem[] =>
    read<DemoPortfolioItem[]>(PORTFOLIO_KEY, []).filter((item) => item.is_visible),

  createPortfolioItem(imageUrl: string, professionName?: string, description?: string): DemoPortfolioItem {
    const item: DemoPortfolioItem = {
      id: id("portfolio"),
      worker_id: "demo-worker",
      image_url: imageUrl,
      profession_name: professionName || null,
      description: description || null,
      is_visible: true,
      created_at: new Date().toISOString(),
    };
    write(PORTFOLIO_KEY, [item, ...read<DemoPortfolioItem[]>(PORTFOLIO_KEY, [])].slice(0, 15));
    return item;
  },

  removePortfolioItem(itemId: string) {
    write(PORTFOLIO_KEY, read<DemoPortfolioItem[]>(PORTFOLIO_KEY, []).filter((item) => item.id !== itemId));
  },

  getReferralCode(): string {
    const state = referralState();
    if (state.code) return state.code;
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    write(REFERRALS_KEY, { ...state, code });
    return code;
  },

  applyReferralCode(code: string) {
    const state = referralState();
    if (code === state.code) throw new Error("საკუთარი მოწვევის კოდის გამოყენება არ შეიძლება.");
    if (state.appliedCode) return { ok: true, message: "მოწვევის კოდი უკვე გამოყენებულია." };
    write(REFERRALS_KEY, { ...state, appliedCode: code });
    return { ok: true, message: "მოწვევის კოდი მიღებულია. ბონუსი ჩაირიცხება, როცა მოწვეული მეგობარი რეგისტრაციას დაასრულებს." };
  },
};
