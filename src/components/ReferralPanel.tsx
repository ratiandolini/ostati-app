import React, { useEffect, useState } from "react";
import { applyReferralCode, getReferralCode } from "../services/marketplaceApiService";

const friendlyReferralError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Referral code was not found")) {
    return "ეს მოწვევის კოდი ვერ მოიძებნა. გადაამოწმე და თავიდან სცადე.";
  }
  if (message.includes("own code")) {
    return "საკუთარი მოწვევის კოდის გამოყენება არ შეიძლება.";
  }
  if (message.includes("row-level security") || message.includes("get_or_create_referral_code")) {
    return "მოწვევის კოდი ჯერ ვერ შეიქმნა. Supabase-ში თავიდან გაუშვი marketplace_growth.sql.";
  }
  return "მოწვევის კოდის დამუშავება ვერ მოხერხდა. ცოტა ხანში თავიდან სცადე.";
};

export const ReferralPanel: React.FC<{ roleLabel: string }> = ({ roleLabel }) => {
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [loadingCode, setLoadingCode] = useState(true);

  useEffect(() => {
    getReferralCode()
      .then((nextCode) => {
        setCode(nextCode);
        setLoadingCode(false);
      })
      .catch((error) => {
        setMessage(friendlyReferralError(error));
        setLoadingCode(false);
      });
  }, []);

  const apply = async () => {
    const normalizedCode = input.trim().toUpperCase();
    if (normalizedCode.length !== 8) {
      setMessage("მეგობრის კოდი ზუსტად 8 სიმბოლოსგან შედგება.");
      return;
    }
    try {
      const result = await applyReferralCode(normalizedCode);
      setMessage(result.message);
      setInput("");
    } catch (error) {
      setMessage(friendlyReferralError(error));
    }
  };
  const copy = async () => { if (!code) return; try { await navigator.clipboard.writeText(code); setMessage("კოდი დაკოპირებულია."); } catch { setMessage(`შენი კოდი: ${code}`); } };
  return <section style={{ marginTop: 22, padding: 16, borderRadius: 16, border: "1px solid var(--border)", background: "white" }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>მოიწვიე {roleLabel}</h2>
    <p style={{ margin: "5px 0 12px", color: "var(--text2)", fontSize: 12, lineHeight: 1.5, fontWeight: 700 }}>შენს პირად კოდს სისტემა ავტომატურად ქმნის. გაუზიარე მეგობარს და ბონუსი ჩაირიცხება მისი რეალური აქტივობის შემდეგ.</p>
    {loadingCode ? <div style={{ minHeight: 42, display: "grid", placeItems: "center", borderRadius: 10, background: "#f4f7fb", color: "var(--text2)", fontSize: 12, fontWeight: 800 }}>კოდი იტვირთება...</div> : code ? <button type="button" onClick={() => void copy()} style={{ width: "100%", minHeight: 42, borderRadius: 10, background: "#eef6ff", color: "var(--primary)", border: "1px solid #bfdbfe", fontWeight: 900, whiteSpace: "nowrap" }}>შენი კოდი: {code} · კოპირება</button> : null}
    <label style={{ display: "block", marginTop: 14, color: "var(--text)", fontSize: 12, fontWeight: 900 }}>თუ მეგობარმა თავისი კოდი მოგცა</label>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, marginTop: 6 }}><input value={input} maxLength={8} onChange={(event) => setInput(event.target.value.replace(/\s/g, "").toUpperCase())} placeholder="8-სიმბოლოიანი კოდი" style={{ width: "100%", minWidth: 0, height: 42, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 10, fontWeight: 800 }} /><button type="button" disabled={input.trim().length !== 8} onClick={() => void apply()} style={{ minWidth: 92, padding: "0 12px", borderRadius: 10, background: "var(--primary)", color: "white", fontWeight: 900, whiteSpace: "nowrap", opacity: input.trim().length === 8 ? 1 : .45 }}>დამატება</button></div>
    {message && <p style={{ margin: "9px 0 0", color: "var(--text2)", fontSize: 12, fontWeight: 750 }}>{message}</p>}
  </section>;
};
