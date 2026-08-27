import React, { useEffect, useState } from "react";
import { categories, georgiaCities } from "../data/workers";
import { cancelMyJobPost, createJobPost, expressInterest, JobPost, loadMyJobPosts, loadOpenJobPosts } from "../services/marketplaceApiService";
import { createStoragePath, uploadStorageFile } from "../services/supabaseStorageService";

const panelStyle: React.CSSProperties = { marginTop: 22, padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "white", overflow: "hidden" };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, marginTop: 6, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", color: "var(--text)", font: "inherit", fontWeight: 700 };
const buttonStyle: React.CSSProperties = { minHeight: 42, padding: "0 14px", borderRadius: 10, background: "var(--primary)", color: "white", fontWeight: 900, whiteSpace: "nowrap" };

const messageFrom = (error: unknown) => error instanceof Error ? error.message : "მოთხოვნის შესრულება ვერ მოხერხდა.";
const uploadErrorMessage = (error: unknown) => {
  const message = messageFrom(error);
  if (/EntityTooLarge|size/i.test(message)) return "ფოტო ძალიან დიდია. აირჩიე 5 მბ-მდე JPG, PNG ან WebP ფაილი.";
  if (/Unauthorized|RLS|permission/i.test(message)) return "ფოტოს ატვირთვა დროებით ვერ მოხერხდა. გადაამოწმე კავშირი და თავიდან სცადე; თუ განმეორდა, მხარდაჭერას მიმართე.";
  return message;
};

export const ClientJobPostsPanel: React.FC = () => {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
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
    const previews = photos.map((photo) => URL.createObjectURL(photo));
    setPhotoPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [photos]);

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!profession) nextErrors.profession = "აირჩიე საჭირო პროფესია, მაგალითად: მალიარი.";
    if (description.trim().length < 20) nextErrors.description = "გასაგებად აღწერე სამუშაო, მინიმუმ 20 სიმბოლოთი.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setMessage("განცხადება ჯერ ვერ გამოქვეყნდება. მონიშნული ველები შეავსე.");
      return;
    }
    setErrors({}); setSaving(true); setMessage("");
    try {
      const photoUrls = (await Promise.all(photos.map(async (photo, index) => {
        const uploaded = await uploadStorageFile({
          bucket: "job-post-photos",
          file: photo,
          path: createStoragePath("requests", photo, `request-${index + 1}`),
        });
        return uploaded.publicUrl;
      }))).filter((url): url is string => Boolean(url));
      const automaticTitle = `${profession} — სამუშაო მოთხოვნა`;
      const post = await createJobPost({ title: title.trim() || automaticTitle, professionName: profession, city, areaLabel: area, description, photoUrls });
      setPosts((current) => [post, ...current]);
      setTitle(""); setProfession(""); setArea(""); setDescription(""); setPhotos([]); setExpanded(false);
      setMessage("განცხადება გამოქვეყნდა. მაქსიმუმ 5 ხელოსანი შეძლებს ინტერესის გამოხატვას.");
    } catch (error) { setMessage(photos.length ? uploadErrorMessage(error) : messageFrom(error)); } finally { setSaving(false); }
  };

  const cancel = async (postId: string) => {
    setSaving(true); setMessage("");
    try {
      const cancelled = await cancelMyJobPost(postId);
      setPosts((current) => current.map((post) => post.id === postId ? cancelled : post));
      setMessage("მოთხოვნა გაუქმდა. ხელოსნებს ის აღარ გამოუჩნდებათ.");
    } catch (error) { setMessage(messageFrom(error)); } finally { setSaving(false); }
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
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>საჭირო პროფესია *
        <select value={profession} onChange={(event) => { setProfession(event.target.value); setErrors((current) => ({ ...current, profession: "" })); }} style={{ ...inputStyle, borderColor: errors.profession ? "#dc2626" : "var(--border)" }}><option value="">აირჩიე საჭირო პროფესია</option>{categories.filter((item) => item !== "all").map((item) => <option key={item}>{item}</option>)}</select>
        {errors.profession && <small style={{ color: "#b91c1c" }}>{errors.profession}</small>}
      </label>
      <select value={city} onChange={(event) => setCity(event.target.value)} style={inputStyle}>{georgiaCities.map((item) => <option key={item}>{item}</option>)}</select>
      <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="უბანი ან რაიონი, ზუსტი მისამართის გარეშე" style={inputStyle} />
      <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)" }}>სამუშაოს მოკლე აღწერა *
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
    {posts.slice(0, 3).map((post) => <div key={post.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>{(post.photo_urls?.[0] || post.photo_url) && <img src={post.photo_urls?.[0] || post.photo_url || ""} alt="" style={{ width: 72, height: 58, float: "right", marginLeft: 10, borderRadius: 8, objectFit: "cover" }} />}<strong>{post.title}</strong><div style={{ marginTop: 4, fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>{post.profession_name} · {post.city}{post.area_label ? ` · ${post.area_label}` : ""}</div><div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: post.status === "open" ? "#047857" : "var(--text2)" }}>{post.status === "open" ? "მიღება ღიაა" : post.status === "cancelled" ? "გაუქმებულია" : "ხელოსანი არჩეულია"}</div>{post.status === "open" && <button type="button" disabled={saving} onClick={() => void cancel(post.id)} style={{ marginTop: 8, minHeight: 34, padding: "0 10px", borderRadius: 8, background: "white", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 900 }}>მოთხოვნის გაუქმება</button>}<div style={{ clear: "both" }} /></div>)}
  </section>;
};

export const CraftsmanJobPostsPanel: React.FC = () => {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { const controller = new AbortController(); loadOpenJobPosts(controller.signal).then(setPosts).catch(() => undefined); return () => controller.abort(); }, []);
  const respond = async (id: string) => { setBusyId(id); setMessage(""); try { await expressInterest(id, "ინტერესი მაქვს ამ მოთხოვნაზე."); setPosts((items) => items.filter((item) => item.id !== id)); setMessage("ინტერესი გაიგზავნა. კლიენტი მხოლოდ რამდენიმე კანდიდატს ნახავს და თავად აირჩევს."); } catch (error) { setMessage(messageFrom(error)); } finally { setBusyId(""); } };
  return <section style={panelStyle}><h2 style={{ margin: 0, fontSize: 18 }}>ახალი მოთხოვნები</h2><p style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>კლიენტის ნომერი და ზუსტი მისამართი არჩევამდე არ ჩანს.</p>{message && <p style={{ fontSize: 12, color: "var(--text2)", fontWeight: 800 }}>{message}</p>}{posts.length ? posts.slice(0, 5).map((post) => <article key={post.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>{(post.photo_urls?.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginBottom: 10 }}>{(post.photo_urls?.length ? post.photo_urls : [post.photo_url!]).map((url) => <img key={url} src={url} alt="კლიენტის მიერ ატვირთული სამუშაო ადგილი" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 9, objectFit: "cover", display: "block" }} />)}</div>}<strong>{post.title}</strong><p style={{ margin: "5px 0", fontSize: 12, color: "var(--text2)", lineHeight: 1.4 }}>{post.description}</p><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12, fontWeight: 800 }}><span>{post.profession_name} · {post.city}</span><button type="button" disabled={busyId === post.id} onClick={() => respond(post.id)} style={{ ...buttonStyle, minHeight: 36 }}>{busyId === post.id ? "იგზავნება" : "ინტერესი"}</button></div></article>) : <p style={{ margin: "12px 0 0", color: "var(--text2)", fontSize: 13, fontWeight: 700 }}>ამ ეტაპზე შენს კატეგორიაში ახალი მოთხოვნა არ ჩანს.</p>}</section>;
};
