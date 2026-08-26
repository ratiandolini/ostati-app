import React, { useEffect, useState } from "react";
import { applyReferralCode, getReferralCode } from "../services/marketplaceApiService";

export const ReferralPanel: React.FC<{ roleLabel: string }> = ({ roleLabel }) => {
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { getReferralCode().then(setCode).catch(() => undefined); }, []);
  const apply = async () => { try { const result = await applyReferralCode(input); setMessage(result.message); setInput(""); } catch (error) { setMessage(error instanceof Error ? error.message : "კოდის დამატება ვერ მოხერხდა."); } };
  const copy = async () => { if (!code) return; try { await navigator.clipboard.writeText(code); setMessage("კოდი დაკოპირებულია."); } catch { setMessage(`შენი კოდი: ${code}`); } };
  return <section style={{ marginTop: 22, padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "white" }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>მოიწვიე {roleLabel}</h2>
    <p style={{ margin: "5px 0 12px", color: "var(--text2)", fontSize: 12, lineHeight: 1.4, fontWeight: 700 }}>ბონუსი ირიცხება მხოლოდ რეალური აქტივობის შემდეგ, რათა სისტემა სამართლიანი დარჩეს.</p>
    {code && <button type="button" onClick={() => void copy()} style={{ width: "100%", minHeight: 42, borderRadius: 10, background: "#eef6ff", color: "var(--primary)", border: "1px solid #bfdbfe", fontWeight: 900 }}>შენი კოდი: {code} · კოპირება</button>}
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}><input value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} placeholder="მეგობრის კოდი" style={{ flex: 1, minWidth: 0, height: 42, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 800 }} /><button type="button" disabled={!input.trim()} onClick={() => void apply()} style={{ padding: "0 12px", borderRadius: 10, background: "var(--primary)", color: "white", fontWeight: 900 }}>დამატება</button></div>
    {message && <p style={{ margin: "9px 0 0", color: "var(--text2)", fontSize: 12, fontWeight: 750 }}>{message}</p>}
  </section>;
};
