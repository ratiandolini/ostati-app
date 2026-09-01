import React, { useState } from "react";
import { dataService, isDemoDataMode } from "../services/dataService";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import {
  requestPhoneOtp,
  signInOrSignUpWithEmail,
  usesEmailPasswordAuth,
  verifyPhoneOtp,
} from "../services/supabaseAuthService";
import {
  emailLoginSchema,
  getValidationMessage,
  phoneLoginSchema,
} from "../services/validation";

interface LoginScreenProps {
  onLogin: (
    phone: string,
    role: "client" | "craftsman" | "admin"
  ) => void | Promise<void>;
  adminOnly?: boolean;
  onExitAdmin?: () => void;
}

type LoginStep = "role" | "phone" | "code";
type LoginRole = "client" | "craftsman" | "admin";

const heroImage =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&auto=format&fit=crop";

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  adminOnly = false,
  onExitAdmin,
}) => {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<LoginStep>("role");
  const [role, setRole] = useState<LoginRole>(adminOnly ? "admin" : "client");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [generatedCode] = useState("1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const { legalSettings } = usePlatformSettings();
  const emailAuth = !isDemoDataMode && usesEmailPasswordAuth();

  const rememberedPhone = isDemoDataMode
    ? role === "admin"
      ? ""
      : dataService.getRememberedPhone(role)
    : "";

  const chooseRole = (nextRole: LoginRole) => {
    const nextRememberedPhone = isDemoDataMode
      ? nextRole === "admin"
        ? ""
        : dataService.getRememberedPhone(nextRole)
      : "";
    setRole(nextRole);
    setPhone(nextRememberedPhone || "");
    setError("");
    setStep("phone");
  };

  const handleSendCode = async () => {
    const validation = emailAuth
      ? emailLoginSchema.safeParse({ email: phone, password })
      : phoneLoginSchema.safeParse({ phone });

    if (!validation.success) {
      setError(getValidationMessage(validation.error, "მონაცემები გადაამოწმეთ"));
      return;
    }

    if (isDemoDataMode && rememberedPhone === phone) {
      onLogin(phone, role);
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (emailAuth) {
        await signInOrSignUpWithEmail(phone, password, role, role !== "admin");
        await onLogin(phone.trim().toLowerCase(), role);
        return;
      }
      if (!isDemoDataMode) {
        await requestPhoneOtp(`+995${phone}`, role);
      }
      setStep("code");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "კოდის გაგზავნა ვერ მოხერხდა"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (isDemoDataMode && code === generatedCode) {
      if (role !== "admin") {
        dataService.rememberPhone(role, phone);
      }
      onLogin(phone, role);
      return;
    }

    if (isDemoDataMode) {
      setError("კოდი არასწორია. სცადე: 1234");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyPhoneOtp(`+995${phone}`, code, role);
      onLogin(phone, role);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "კოდი ვერ დადასტურდა"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <img src={heroImage} alt="" className="auth-hero-image" />
        <div className="auth-hero-overlay" />
      </div>

      <div className="auth-content fade-up">
        <div className="auth-brand">
          <div className="auth-logo">🔨</div>
          <span>რემონტერი</span>
        </div>

        {adminOnly ? (
          <>
            <h1 className="auth-title">Admin შესვლა</h1>
            <p className="auth-subtitle">შეიყვანე owner ანგარიშის ელ.ფოსტა და პაროლი</p>

            <label className="auth-label">ელ.ფოსტა</label>
            <div className={`auth-input-row ${error ? "auth-input-error" : ""}`}>
              <input
                type="email"
                placeholder="name@example.com"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <label className="auth-label" style={{ marginTop: 12 }}>პაროლი</label>
            <input
              className={`auth-password-input ${error ? "auth-input-error" : ""}`}
              type="password"
              placeholder="მინ. 6 სიმბოლო"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" onClick={handleSendCode} disabled={loading}>
              {loading ? "მოწმდება..." : "შესვლა"}
              <span>›</span>
            </button>
            <button className="auth-link-button" onClick={onExitAdmin}>
              დაბრუნება მთავარ შესვლაზე
            </button>
          </>
        ) : step === "role" && (
          <>
            <h1 className="auth-title">
              იპოვე სანდო ხელოსანი შენი სახლისთვის
            </h1>
            <p className="auth-subtitle">აირჩიე როგორ გსურს შესვლა</p>

            <button className="auth-role auth-role-primary" onClick={() => chooseRole("client")}>
              <span className="auth-role-icon">🔎</span>
              <span className="auth-role-copy">
                <strong>შესვლა როგორც კლიენტი</strong>
                <small>ვეძებ ხელოსანს</small>
              </span>
              <span className="auth-role-arrow">›</span>
            </button>

            <button className="auth-role" onClick={() => chooseRole("craftsman")}>
              <span className="auth-role-icon">🔨</span>
              <span className="auth-role-copy">
                <strong>შესვლა როგორც ხელოსანი</strong>
                <small>ვარ ხელოსანი, ვეძებ კლიენტებს</small>
              </span>
              <span className="auth-role-arrow">›</span>
            </button>

            <p className="auth-footnote">
              შესვლით თქვენ ეთანხმებით{" "}
              <button
                type="button"
                onClick={() => setShowRules(true)}
                style={{
                  display: "inline",
                  padding: 0,
                  background: "transparent",
                  color: "var(--primary)",
                  border: 0,
                  fontSize: "inherit",
                  fontWeight: 900,
                  textDecoration: "underline",
                }}
              >
                მომსახურების პირობებს
              </button>
            </p>
          </>
        )}

        {step === "phone" && (
          <>
            <h1 className="auth-title">
              {role === "client"
                ? "კლიენტის შესვლა"
                : role === "craftsman"
                ? "ხელოსნის შესვლა"
                : "Admin შესვლა"}
            </h1>
            <p className="auth-subtitle">
              {isDemoDataMode
                ? "ნაცნობი ნომრით პირდაპირ შეხვალ, ახალ ნომერზე კი კოდი გაიგზავნება"
                : emailAuth
                  ? "შეიყვანე ელ.ფოსტა და პაროლი"
                  : "სატესტოდ გამოიყენე კოდი 1234"}
            </p>

            <label className="auth-label">
              {emailAuth ? "ელ.ფოსტა" : "მობილურის ნომერი"}
            </label>
            <div className={`auth-input-row ${error ? "auth-input-error" : ""}`}>
              {!emailAuth && <span>+995</span>}
              <input
                type={emailAuth ? "email" : "tel"}
                placeholder={emailAuth ? "name@example.com" : "555 12 34 56"}
                value={phone}
                onChange={(e) =>
                  setPhone(
                    emailAuth
                      ? e.target.value
                      : e.target.value.replace(/\D/g, "").slice(0, 9)
                  )
                }
              />
            </div>
            {emailAuth && (
              <>
                <label className="auth-label" style={{ marginTop: 12 }}>
                  პაროლი
                </label>
                <input
                  className={`auth-password-input ${
                    error ? "auth-input-error" : ""
                  }`}
                  type="password"
                  placeholder="მინ. 6 სიმბოლო"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            )}
            {error && <div className="auth-error">{error}</div>}

            <button
              className="auth-submit"
              onClick={handleSendCode}
              disabled={loading}
            >
              {loading
                ? "მოწმდება..."
                : emailAuth
                  ? "შესვლა / რეგისტრაცია"
                  : isDemoDataMode && rememberedPhone === phone
                  ? "შესვლა"
                  : "კოდის გაგზავნა"}
              <span>›</span>
            </button>
            <button
              className="auth-link-button"
              onClick={() => {
                setError("");
                setStep("role");
              }}
            >
              როლის შეცვლა
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="auth-title">კოდის შეყვანა</h1>
            <p className="auth-subtitle">
              კოდი გამოიგზავნა ნომერზე: <strong>+995 {phone}</strong>
            </p>

            <div className="auth-code-hint">სატესტო კოდი: 1234</div>

            <label className="auth-label">დამადასტურებელი კოდი</label>
            <input
              className={`auth-code-input ${error ? "auth-input-error" : ""}`}
              type="tel"
              placeholder="0000"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
            {error && <div className="auth-error">{error}</div>}

            <button
              className="auth-submit"
              onClick={handleVerifyCode}
              disabled={code.length !== 4 || loading}
            >
              {loading ? "მოწმდება..." : "დადასტურება"}
              <span>›</span>
            </button>
            <button
              className="auth-link-button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
              }}
            >
              ნომრის შეცვლა
            </button>
          </>
        )}
      </div>

      {showRules && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 140,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.4)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "82%",
              overflowY: "auto",
              padding: 22,
              borderRadius: "22px 22px 0 0",
              background: "white",
              boxShadow: "0 -18px 45px rgba(15,23,42,0.18)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 21, fontWeight: 950 }}>
              მომსახურების პირობები
            </h2>
            <p style={{ margin: "0 0 14px", color: "var(--text2)", fontSize: 12, lineHeight: 1.5, fontWeight: 750 }}>
              ეს არის სატესტო ტექსტი. საბოლოო იურიდიული ვერსია ადმინ პანელიდან
              განახლდება და შემდეგ საბოლოო ვერსიაში იგივე ტექსტი გამოჩნდება.
            </p>
            {[
              ["ჯავშანი", legalSettings.bookingRules],
              ["გაუქმება", legalSettings.cancellationRules],
              ["კონტაქტი და კონფიდენციალურობა", legalSettings.privacyRules],
              ["დავები და დახმარება", legalSettings.supportRules],
            ].map(([title, text]) => (
              <section
                key={title}
                style={{
                  marginBottom: 10,
                  padding: 12,
                  borderRadius: 13,
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                }}
              >
                <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
                  {title}
                </strong>
                <span style={{ display: "block", marginTop: 5, color: "var(--text2)", fontSize: 12, lineHeight: 1.5, fontWeight: 750 }}>
                  {text}
                </span>
              </section>
            ))}
            <button
              type="button"
              onClick={() => setShowRules(false)}
              style={{
                width: "100%",
                minHeight: 46,
                marginTop: 4,
                borderRadius: 12,
                background: "var(--primary)",
                color: "white",
                fontSize: 14,
                fontWeight: 950,
              }}
            >
              გასაგებია
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
