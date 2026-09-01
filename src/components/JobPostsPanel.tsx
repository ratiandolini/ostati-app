import React, { useEffect, useState } from "react";
import { categoryGroups, georgiaCities, getCategoryById, getServiceSelectionLabel, makeServiceSelection, workerMatchesService } from "../data/workers";
import { cancelMyJobPost, createJobPost, expressInterest, JobPost, JobPostInterest, loadCurrentWorkerJobPostInterests, loadMyJobPosts, loadOpenJobPosts, withdrawInterestInJobPost } from "../services/marketplaceApiService";
import { createStoragePath, uploadStorageFile } from "../services/supabaseStorageService";
import { isDemoDataMode } from "../services/dataService";

const panelStyle: React.CSSProperties = { marginTop: 22, padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "white", overflow: "hidden" };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, marginTop: 6, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", color: "var(--text)", font: "inherit", fontWeight: 700 };
const buttonStyle: React.CSSProperties = { minHeight: 42, padding: "0 14px", borderRadius: 10, background: "var(--primary)", color: "white", fontWeight: 900, whiteSpace: "nowrap" };
const formatJobPostCreatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "თარიღი უცნობია";
  return date.toLocaleString("ka-GE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
};

const messageFrom = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (/This request is no longer open/i.test(message)) return "ეს მოთხოვნა უკვე დაიხურა ან კლიენტმა გააუქმა. სია განახლდა.";
  if (/Only an open request created by you can be cancelled/i.test(message)) return "ეს მოთხოვნა უკვე დახურულია ან შენი ანგარიშით არ არის შექმნილი. სია განახლდა.";
  if (/already has enough responses/i.test(message)) return "ამ მოთხოვნაზე უკვე საკმარისი ხელოსანი დაინტერესდა. სია განახლდა.";
  if (/Only verified active craftspeople/i.test(message)) return "ინტერესის გამოსახატად საჭიროა აქტიური და ვერიფიცირებული ხელოსნის პროფილი.";
  return message || "მოთხოვნის შესრულება ვერ მოხერხდა.";
};
const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("ფოტოს წაკითხვა ვერ მოხერხდა."));
  reader.onerror = () => reject(new Error("ფოტოს წაკითხვა ვერ მოხერხდა."));
  reader.readAsDataURL(file);
});
const uploadErrorMessage = (error: unknown) => {
  const message = messageFrom(error);
  if (/EntityTooLarge|size/i.test(message)) return "ფოტო ძალიან დიდია. აირჩიე 5 მბ-მდე JPG, PNG ან WebP ფაილი.";
  if (/Unauthorized|RLS|permission/i.test(message)) return "ფოტოს ატვირთვა დროებით ვერ მოხერხდა. გადაამოწმე კავშირი და თავიდან სცადე; თუ განმეორდა, მხარდაჭერას მიმართე.";
  return message;
};

export const ClientJobPostsPanel: React.FC = () => {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("თბილისი");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    loadMyJobPosts(controller.signal).then(setPosts).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(photos.map(fileToDataUrl))
      .then((previews) => { if (!cancelled) setPhotoPreviews(previews); })
      .catch(() => { if (!cancelled) setPhotoPreviews([]); });
    return () => { cancelled = true; };
  }, [photos]);

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!profession) nextErrors.profession = "ჯერ აირჩიე კატეგორია, შემდეგ კი კონკრეტული სამუშაო.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setMessage("განცხადება ჯერ ვერ გამოქვეყნდება. მონიშნული ველები შეავსე.");
      return;
    }
    setErrors({}); setSaving(true); setMessage("");
    try {
      const photoUrls = (await Promise.all(photos.map(async (photo, index) => {
        if (isDemoDataMode) return fileToDataUrl(photo);
        const uploaded = await uploadStorageFile({
          bucket: "job-post-photos",
          file: photo,
          path: createStoragePath("requests", photo, `request-${index + 1}`),
        });
        return uploaded.publicUrl;
      }))).filter((url): url is string => Boolean(url));
      const automaticTitle = `${getServiceSelectionLabel(profession)} — სამუშაო მოთხოვნა`;
      const safeTitle = (title.trim() || automaticTitle).slice(0, 160);
      const post = await createJobPost({ title: safeTitle, professionName: profession, city, areaLabel: area, description, photoUrls });
      setPosts((current) => [post, ...current]);
      setTitle(""); setCategoryId(""); setProfession(""); setArea(""); setDescription(""); setPhotos([]); setExpanded(false);
      setMessage("განცხადება გამოქვეყნდა. მაქსიმუმ 5 ხელოსანი შეძლებს ინტერესის გამოხატვას.");
    } catch (error) { setMessage(photos.length ? uploadErrorMessage(error) : messageFrom(error)); } finally { setSaving(false); }
  };

  const cancel = async (postId: string) => {
    if (!window.confirm("ნამდვილად გსურს ამ მოთხოვნის გაუქმება? ხელოსნებს ის აღარ გამოუჩნდებათ.")) return;
    setSaving(true); setMessage("");
    try {
      const cancelled = await cancelMyJobPost(postId);
      setPosts((current) => current.filter((post) => post.id !== cancelled.id));
      setMessage("მოთხოვნა გაუქმდა. ხელოსნებს ის აღარ გამოუჩნდებათ.");
    } catch (error) {
      setMessage(messageFrom(error));
      loadMyJobPosts().then(setPosts).catch(() => undefined);
    } finally { setSaving(false); }
  };

  return <section style={panelStyle}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.25 }}>შენი მოთხოვნები</h2><p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--text2)", fontWeight: 700 }}>აღწერე სამუშაო და დაინტერესებული ხელოსნებიდან თავად აირჩიე.</p></div>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={{ ...buttonStyle, minWidth: 94, maxWidth: 104, padding: "7px 10px", lineHeight: 1.25 }}>{expanded ? "დახურვა" : "+ დამატება"}</button>
    </div>
    {expanded && <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>სათაური (არასავალდებულო - ავტომატურად შეივსება)
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="მაგ: აბაზანის სანტექნიკის შეკეთება" style={inputStyle} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>სამუშაოს კატეგორია *
        <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setProfession(""); setErrors((current) => ({ ...current, profession: "" })); }} style={{ ...inputStyle, borderColor: errors.profession ? "#dc2626" : "var(--border)" }}><option value="">აირჩიე კატეგორია</option>{categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select>
      </label>
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>კონკრეტული სამუშაო *
        <select disabled={!categoryId} value={profession} onChange={(event) => { setProfession(event.target.value); setErrors((current) => ({ ...current, profession: "" })); }} style={{ ...inputStyle, borderColor: errors.profession ? "#dc2626" : "var(--border)", opacity: categoryId ? 1 : .65 }}><option value="">{categoryId ? "აირჩიე კონკრეტული სამუშაო" : "ჯერ აირჩიე კატეგორია"}</option>{getCategoryById(categoryId)?.subcategories.map((item) => <option key={item.label} value={makeServiceSelection(categoryId, item.label)}>{item.label}</option>)}</select>
        {errors.profession && <small style={{ color: "#b91c1c" }}>{errors.profession}</small>}
      </label>
      <select value={city} onChange={(event) => setCity(event.target.value)} style={inputStyle}>{georgiaCities.map((item) => <option key={item}>{item}</option>)}</select>
      <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="უბანი ან რაიონი, ზუსტი მისამართის გარეშე" style={inputStyle} />
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>სამუშაოს აღწერა
        <textarea value={description} onChange={(event) => { setDescription(event.target.value); setErrors((current) => ({ ...current, description: "" })); }} placeholder="რა უნდა გაკეთდეს და რა მდგომარეობაა" rows={4} style={{ ...inputStyle, height: "auto", padding: 12, resize: "vertical", borderColor: errors.description ? "#dc2626" : "var(--border)" }} />
        {errors.description && <small style={{ color: "#b91c1c" }}>{errors.description}</small>}
      </label>
      <label style={{ display: "grid", gap: 7, padding: 12, border: "1px dashed #bfd0e5", borderRadius: 10, background: "#f8fbff", color: "var(--text)", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
        <span>{photos.length ? "ფოტოების დამატება ან შეცვლა" : "სამუშაო ადგილის ფოტოების დამატება"}</span>
        <small style={{ color: "var(--text2)", lineHeight: 1.4, fontWeight: 700 }}>სურვილისამებრ დაამატე 1-3 ფოტო - ხელოსანი სამუშაოს უკეთ შეაფასებს.</small>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const next = Array.from(event.target.files || []).slice(0, 3); setPhotos(next); event.currentTarget.value = ""; }} style={{ display: "none" }} />
      </label>
      {photoPreviews.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>{photoPreviews.map((preview, index) => <div key={preview} style={{ position: "relative" }}><img src={preview} alt={`არჩეული სამუშაო ადგილი ${index + 1}`} style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 10, objectFit: "cover", display: "block" }} /><button type="button" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ position: "absolute", top: 5, right: 5, minWidth: 28, height: 28, borderRadius: 8, background: "rgba(15, 29, 50, .9)", color: "white", fontWeight: 900 }} aria-label="ფოტოს წაშლა">×</button></div>)}</div>}
      <button type="button" disabled={saving} onClick={submit} style={{ ...buttonStyle, opacity: saving ? .55 : 1 }}>{saving ? "იტვირთება..." : "გამოქვეყნება"}</button>
    </div>}
    {message && <p role="alert" style={{ margin: "12px 0 0", color: Object.keys(errors).length ? "#b91c1c" : "var(--text2)", fontSize: 12, fontWeight: 800, lineHeight: 1.4 }}>{message}</p>}
    {posts.slice(0, 3).map((post) => {
      const isPostExpanded = expandedPostId === post.id;
      const urls = post.photo_urls?.length ? post.photo_urls : post.photo_url ? [post.photo_url] : [];
      return <div key={post.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={() => setExpandedPostId(isPostExpanded ? "" : post.id)} style={{ width: "100%", padding: 0, background: "transparent", color: "var(--text)", textAlign: "left" }}>
          <strong>{post.title}</strong>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>{getServiceSelectionLabel(post.profession_name)} · {post.city}{post.area_label ? ` · ${post.area_label}` : ""}</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 900, color: "var(--primary)" }}>{isPostExpanded ? "დეტალების დახურვა" : "დეტალების ნახვა"}</div>
        </button>
        {isPostExpanded && <div style={{ marginTop: 10 }}>
          {urls.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginBottom: 10 }}>{urls.map((url) => <img key={url} src={url} alt="სამუშაო ადგილის ფოტო" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 9, objectFit: "cover", display: "block" }} />)}</div>}
          {post.description.trim() && <p style={{ margin: "0", color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>{post.description}</p>}
        </div>}
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 800, color: post.status === "open" ? "#047857" : "var(--text2)" }}>{post.status === "open" ? "მიღება ღიაა" : post.status === "cancelled" ? "გაუქმებულია" : "ხელოსანი არჩეულია"}</div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text3)", fontWeight: 750 }}>გამოქვეყნდა: {formatJobPostCreatedAt(post.created_at)}</div>
        {post.status === "open" && <button type="button" disabled={saving} onClick={() => void cancel(post.id)} style={{ marginTop: 8, minHeight: 34, padding: "0 10px", borderRadius: 8, background: "white", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 900 }}>მოთხოვნის გაუქმება</button>}
      </div>;
    })}
  </section>;
};

export const CraftsmanJobPostsPanel: React.FC<{ professions: string[] }> = ({ professions }) => {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [interests, setInterests] = useState<JobPostInterest[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [skippedIds, setSkippedIds] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("remonterSkippedJobPostIds") || "[]") as string[]; } catch { return []; }
  });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadOpenJobPosts(controller.signal), loadCurrentWorkerJobPostInterests(controller.signal)])
      .then(([nextPosts, nextInterests]) => { setPosts(nextPosts); setInterests(nextInterests); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const refresh = async () => {
    const [nextPosts, nextInterests] = await Promise.all([loadOpenJobPosts(), loadCurrentWorkerJobPostInterests()]);
    setPosts(nextPosts); setInterests(nextInterests);
  };
  const respond = async (id: string) => {
    setBusyId(id); setMessage("");
    try {
      const interest = await expressInterest(id, "ინტერესი მაქვს ამ მოთხოვნაზე.");
      setInterests((items) => [interest as JobPostInterest, ...items]);
      setMessage("ინტერესი გაიგზავნა. კლიენტი კანდიდატებს ნახავს და თავად აირჩევს.");
    } catch (error) {
      setMessage(messageFrom(error));
      if (/no longer open|enough responses/i.test(error instanceof Error ? error.message : "")) await refresh();
    } finally { setBusyId(""); }
  };
  const withdraw = async (interest: JobPostInterest) => {
    setBusyId(interest.job_post_id); setMessage("");
    try {
      await withdrawInterestInJobPost(interest.id);
      setInterests((items) => items.map((item) => item.id === interest.id ? { ...item, status: "withdrawn" } : item));
      setMessage("ინტერესი გაუქმდა. კლიენტი შენს კანდიდატურას აღარ ნახავს.");
    } catch (error) { setMessage(messageFrom(error)); } finally { setBusyId(""); }
  };
  const skip = (postId: string) => {
    setSkippedIds((current) => {
      const next = current.includes(postId) ? current : [...current, postId];
      window.localStorage.setItem("remonterSkippedJobPostIds", JSON.stringify(next));
      return next;
    });
  };
  const visiblePosts = posts.filter((post) => !skippedIds.includes(post.id) && workerMatchesService(professions, post.profession_name));
  return <section style={panelStyle}>
    <h2 style={{ margin: 0, fontSize: 18 }}>ახალი მოთხოვნები</h2>
    <p style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--text2)", fontWeight: 700, lineHeight: 1.45 }}>კლიენტთან კომუნიკაცია მხოლოდ აპლიკაციის ჩატში მიმდინარეობს. ჯერ გახსენი დეტალები, შემდეგ გადაწყვიტე ინტერესის გამოხატვა.</p>
    {message && <p role="alert" style={{ fontSize: 12, color: "var(--text2)", fontWeight: 800, lineHeight: 1.4 }}>{message}</p>}
    {visiblePosts.length ? visiblePosts.slice(0, 5).map((post) => {
      const interest = interests.find((item) => item.job_post_id === post.id && item.status === "pending");
      const isExpanded = expandedId === post.id;
      const urls = post.photo_urls?.length ? post.photo_urls : post.photo_url ? [post.photo_url] : [];
      return <article key={post.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={() => setExpandedId(isExpanded ? "" : post.id)} style={{ width: "100%", padding: 0, background: "transparent", textAlign: "left", color: "var(--text)" }}>
          <strong style={{ display: "block" }}>{post.title}</strong>
          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text2)", fontWeight: 800 }}>{getServiceSelectionLabel(post.profession_name)} · {post.city}{post.area_label ? ` · ${post.area_label}` : ""}</span>
          <span style={{ display: "block", marginTop: 5, fontSize: 12, color: "var(--primary)", fontWeight: 900 }}>{isExpanded ? "დეტალების დახურვა" : "დეტალების ნახვა"}</span>
        </button>
        {isExpanded && <div style={{ marginTop: 10 }}>
          {urls.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginBottom: 10 }}>{urls.map((url) => <img key={url} src={url} alt="კლიენტის მიერ ატვირთული სამუშაო ადგილი" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 9, objectFit: "cover", display: "block" }} />)}</div>}
          <p style={{ margin: "5px 0 10px", fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{post.description}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {interest ? <button type="button" disabled={busyId === post.id} onClick={() => void withdraw(interest)} style={{ ...buttonStyle, minHeight: 36, background: "white", color: "#b91c1c", border: "1px solid #fecaca" }}>{busyId === post.id ? "უქმდება..." : "ინტერესის გაუქმება"}</button> : <button type="button" disabled={busyId === post.id} onClick={() => void respond(post.id)} style={{ ...buttonStyle, minHeight: 36 }}>{busyId === post.id ? "იგზავნება..." : "ინტერესის გამოხატვა"}</button>}
            <button type="button" onClick={() => skip(post.id)} style={{ minHeight: 36, padding: "0 12px", borderRadius: 10, background: "white", color: "var(--text2)", border: "1px solid var(--border)", fontWeight: 900 }}>გამოტოვება</button>
          </div>
        </div>}
      </article>;
    }) : <p style={{ margin: "12px 0 0", color: "var(--text2)", fontSize: 13, fontWeight: 700 }}>ამ ეტაპზე შენს კატეგორიაში ახალი მოთხოვნა არ ჩანს.</p>}
  </section>;
};
