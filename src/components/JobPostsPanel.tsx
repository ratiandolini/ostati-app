import React, { useEffect, useState } from "react";
import { categories, georgiaCities } from "../data/workers";
import { createJobPost, expressInterest, JobPost, loadMyJobPosts, loadOpenJobPosts } from "../services/marketplaceApiService";

const panelStyle: React.CSSProperties = { marginTop: 22, padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "white" };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, marginTop: 6, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 10, background: "#fff", color: "var(--text)", font: "inherit", fontWeight: 700 };
const buttonStyle: React.CSSProperties = { minHeight: 42, padding: "0 14px", borderRadius: 10, background: "var(--primary)", color: "white", fontWeight: 900 };

const messageFrom = (error: unknown) => error instanceof Error ? error.message : "მოთხოვნის შესრულება ვერ მოხერხდა.";

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

  useEffect(() => {
    const controller = new AbortController();
    loadMyJobPosts(controller.signal).then(setPosts).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const submit = async () => {
    if (!title.trim() || !profession || description.trim().length < 20) {
      setMessage("შეავსე სათაური, პროფესია და მინიმუმ 20 სიმბოლოს აღწერა.");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const post = await createJobPost({ title, professionName: profession, city, areaLabel: area, description });
      setPosts((current) => [post, ...current]);
      setTitle(""); setProfession(""); setArea(""); setDescription(""); setExpanded(false);
      setMessage("განცხადება გამოქვეყნდა. მაქსიმუმ 5 ხელოსანი შეძლებს ინტერესის გამოხატვას.");
    } catch (error) { setMessage(messageFrom(error)); } finally { setSaving(false); }
  };

  return <section style={panelStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>შენი მოთხოვნები</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>პირდაპირი ჯავშანი უცვლელად რჩება.</p></div>
      <button type="button" onClick={() => setExpanded((value) => !value)} style={buttonStyle}>{expanded ? "დახურვა" : "განცხადების დამატება"}</button>
    </div>
    {expanded && <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="მაგ: აბაზანის სანტექნიკის შეკეთება" style={inputStyle} />
      <select value={profession} onChange={(event) => setProfession(event.target.value)} style={inputStyle}><option value="">აირჩიე საჭირო პროფესია</option>{categories.filter((item) => item !== "all").map((item) => <option key={item}>{item}</option>)}</select>
      <select value={city} onChange={(event) => setCity(event.target.value)} style={inputStyle}>{georgiaCities.map((item) => <option key={item}>{item}</option>)}</select>
      <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="უბანი ან რაიონი, ზუსტი მისამართის გარეშე" style={inputStyle} />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="რა უნდა გაკეთდეს, რა მდგომარეობაა და როდის გჭირდება" rows={4} style={{ ...inputStyle, height: "auto", padding: 12, resize: "vertical" }} />
      <button type="button" disabled={saving} onClick={submit} style={{ ...buttonStyle, opacity: saving ? .55 : 1 }}>{saving ? "იტვირთება..." : "გამოქვეყნება"}</button>
    </div>}
    {message && <p style={{ margin: "12px 0 0", color: "var(--text2)", fontSize: 12, fontWeight: 800, lineHeight: 1.4 }}>{message}</p>}
    {posts.slice(0, 3).map((post) => <div key={post.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}><strong>{post.title}</strong><div style={{ marginTop: 4, fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>{post.profession_name} · {post.city}{post.area_label ? ` · ${post.area_label}` : ""}</div><div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: post.status === "open" ? "#047857" : "var(--text2)" }}>{post.status === "open" ? "მიღება ღიაა" : "ხელოსანი არჩეულია"}</div></div>)}
  </section>;
};

export const CraftsmanJobPostsPanel: React.FC = () => {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { const controller = new AbortController(); loadOpenJobPosts(controller.signal).then(setPosts).catch(() => undefined); return () => controller.abort(); }, []);
  const respond = async (id: string) => { setBusyId(id); setMessage(""); try { await expressInterest(id, "ინტერესი მაქვს ამ მოთხოვნაზე."); setPosts((items) => items.filter((item) => item.id !== id)); setMessage("ინტერესი გაიგზავნა. კლიენტი მხოლოდ რამდენიმე კანდიდატს ნახავს და თავად აირჩევს."); } catch (error) { setMessage(messageFrom(error)); } finally { setBusyId(""); } };
  return <section style={panelStyle}><h2 style={{ margin: 0, fontSize: 18 }}>ახალი მოთხოვნები</h2><p style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>კლიენტის ნომერი და ზუსტი მისამართი არჩევამდე არ ჩანს.</p>{message && <p style={{ fontSize: 12, color: "var(--text2)", fontWeight: 800 }}>{message}</p>}{posts.length ? posts.slice(0, 5).map((post) => <article key={post.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}><strong>{post.title}</strong><p style={{ margin: "5px 0", fontSize: 12, color: "var(--text2)", lineHeight: 1.4 }}>{post.description}</p><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12, fontWeight: 800 }}><span>{post.profession_name} · {post.city}</span><button type="button" disabled={busyId === post.id} onClick={() => respond(post.id)} style={{ ...buttonStyle, minHeight: 36 }}>{busyId === post.id ? "იგზავნება" : "ინტერესი"}</button></div></article>) : <p style={{ margin: "12px 0 0", color: "var(--text2)", fontSize: 13, fontWeight: 700 }}>ამ ეტაპზე შენს კატეგორიაში ახალი მოთხოვნა არ ჩანს.</p>}</section>;
};
