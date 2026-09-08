import React, { useEffect, useRef, useState } from "react";
import { dataService, isDemoDataMode } from "../services/dataService";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import {
  requestPhoneOtp,
  getPasswordRecoveryLinkState,
  PasswordRecoveryLinkState,
  requestPasswordRecovery,
  signInOrSignUpWithEmail,
  SupabaseAuthSession,
  updatePasswordWithRecoverySession,
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

type LoginStep =
  | "role"
  | "phone"
  | "code"
  | "recovery-request"
  | "recovery-reset"
  | "recovery-success";
type LoginRole = "client" | "craftsman" | "admin";
type AuthMethod = "email" | "mobile";

const heroImage =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&auto=format&fit=crop";

const formatGeorgianMobile = (value: string) => {
  const groups = [
    value.slice(0, 3),
    value.slice(3, 5),
    value.slice(5, 7),
    value.slice(7, 9),
  ];
  return groups.filter(Boolean).join(" ");
};

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
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [mobileNumber, setMobileNumber] = useState("");
  const [phoneNotice, setPhoneNotice] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] =
    useState("");
  const [recoverySession, setRecoverySession] =
    useState<SupabaseAuthSession | null>(null);
  const recoveryLinkCheckStarted = useRef(false);
  const [generatedCode] = useState("1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const { legalSettings } = usePlatformSettings();
  const emailAuth = !isDemoDataMode && usesEmailPasswordAuth();
  const isPhonePreparation = emailAuth && authMethod === "mobile";

  const rememberedPhone = isDemoDataMode
    ? role === "admin"
      ? ""
      : dataService.getRememberedPhone(role)
    : "";

  useEffect(() => {
    if (!emailAuth || adminOnly || recoveryLinkCheckStarted.current) return;
    recoveryLinkCheckStarted.current = true;

    const applyRecoveryLinkState = (result: PasswordRecoveryLinkState) => {
      if (result.status === "none") return;
      setError("");
      if (result.status === "ready") {
        setRecoverySession(result.session);
        setStep("recovery-reset");
        return;
      }
      setRecoverySession(null);
      setStep("recovery-request");
      setError("აღდგენის ბმული არასწორია ან ვადაგასულია. მოითხოვეთ ახალი ბმული.");
    };

    void getPasswordRecoveryLinkState().then(applyRecoveryLinkState);
  }, [adminOnly, emailAuth]);

  const chooseRole = (nextRole: LoginRole) => {
    const nextRememberedPhone = isDemoDataMode
      ? nextRole === "admin"
        ? ""
        : dataService.getRememberedPhone(nextRole)
      : "";
    setRole(nextRole);
    setPhone(nextRememberedPhone || "");
    setError("");
    setPhoneNotice("");
    setStep("phone");
  };

  const selectAuthMethod = (nextMethod: AuthMethod) => {
    setAuthMethod(nextMethod);
    setError("");
    setPhoneNotice("");
  };

  const returnToLogin = () => {
    setError("");
    setPhoneNotice("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirmation("");
    setRecoverySession(null);
    setStep("phone");
  };

  const openPasswordRecovery = () => {
    setRecoveryEmail(phone.trim());
    setError("");
    setPhoneNotice("");
    setStep("recovery-request");
  };

  const handlePasswordRecoveryRequest = async () => {
    const normalizedEmail = recoveryEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("სწორი ელ.ფოსტა შეიყვანეთ");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await requestPasswordRecovery(normalizedEmail);
      setPhoneNotice(
        "თუ ამ ელფოსტით ანგარიში არსებობს, პაროლის აღდგენის ბმულს მიიღებთ."
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "აღდგენის ბმულის გაგზავნა ვერ მოხერხდა. სცადეთ მოგვიანებით."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!recoverySession) {
      setError("აღდგენის ბმული არასწორია ან ვადაგასულია. მოითხოვეთ ახალი ბმული.");
      setStep("recovery-request");
      return;
    }
    if (recoveryPassword.length < 6) {
      setError("პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirmation) {
      setError("პაროლები არ ემთხვევა");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await updatePasswordWithRecoverySession(recoverySession, recoveryPassword);
      setRecoveryPassword("");
      setRecoveryPasswordConfirmation("");
      setRecoverySession(null);
      setStep("recovery-success");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "პაროლის შეცვლა ვერ მოხერხდა. მოითხოვეთ ახალი ბმული."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhonePreparation = () => {
    if (!/^5\d{8}$/.test(mobileNumber)) {
      setPhoneNotice("");
      setError("შეიყვანე 9-ნიშნა ქართული მობილურის ნომერი");
      return;
    }

    setError("");
    setPhoneNotice("მობილურის ნომრით შესვლა მალე გააქტიურდება");
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
          <span>FIXART</span>
        </div>

        {step === "recovery-request" ? (
          <>
            <h1 className="auth-title">პაროლის აღდგენა</h1>
            <p className="auth-subtitle">
              შეიყვანე ელ.ფოსტა და გამოგიგზავნით პაროლის აღდგენის ბმულს.
            </p>
            <label className="auth-label">ელ.ფოსტა</label>
            <div className={`auth-input-row ${error ? "auth-input-error" : ""}`}>
              <input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={recoveryEmail}
                onChange={(event) => {
                  setRecoveryEmail(event.target.value);
                  setError("");
                }}
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            {phoneNotice && <div className="auth-notice">{phoneNotice}</div>}
            <button
              className="auth-submit"
              onClick={handlePasswordRecoveryRequest}
              disabled={loading}
            >
              {loading ? "იგზავნება..." : "აღდგენის ბმულის გაგზავნა"}
              <span>›</span>
            </button>
            <button className="auth-link-button" onClick={returnToLogin}>
              დაბრუნება შესვლაზე
            </button>
          </>
        ) : step === "recovery-reset" ? (
          <>
            <h1 className="auth-title">ახალი პაროლი</h1>
            <p className="auth-subtitle">
              მიუთითე ახალი პაროლი შენი FIXART ანგარიშისთვის.
            </p>
            <label className="auth-label">ახალი პაროლი</label>
            <input
              className={`auth-password-input ${error ? "auth-input-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder="მინ. 6 სიმბოლო"
              value={recoveryPassword}
              onChange={(event) => {
                setRecoveryPassword(event.target.value);
                setError("");
              }}
            />
            <label className="auth-label" style={{ marginTop: 12 }}>
              გაიმეორეთ პაროლი
            </label>
            <input
              className={`auth-password-input ${error ? "auth-input-error" : ""}`}
              type="password"
              autoComplete="new-password"
              placeholder="გაიმეორეთ ახალი პაროლი"
              value={recoveryPasswordConfirmation}
              onChange={(event) => {
                setRecoveryPasswordConfirmation(event.target.value);
                setError("");
              }}
            />
            {error && <div className="auth-error">{error}</div>}
            <button
              className="auth-submit"
              onClick={handlePasswordUpdate}
              disabled={loading}
            >
              {loading ? "იცვლება..." : "პაროლის შეცვლა"}
              <span>›</span>
            </button>
            <button className="auth-link-button" onClick={openPasswordRecovery}>
              ახალი ბმულის მოთხოვნა
            </button>
          </>
        ) : step === "recovery-success" ? (
          <>
            <h1 className="auth-title">პაროლი შეცვლილია</h1>
            <p className="auth-subtitle">
              ახლა შეგიძლია შეხვიდე ახალი პაროლით.
            </p>
            <button className="auth-submit" onClick={returnToLogin}>
              შესვლაზე დაბრუნება
              <span>›</span>
            </button>
          </>
        ) : adminOnly ? (
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
                  ? isPhonePreparation
                    ? "შეიყვანე ქართული მობილურის ნომერი"
                    : "შეიყვანე ელ.ფოსტა და პაროლი"
                  : "სატესტოდ გამოიყენე კოდი 1234"}
            </p>

            {emailAuth && (
              <div
                className="auth-method-switch"
                role="group"
                aria-label="შესვლის მეთოდი"
              >
                <button
                  type="button"
                  className={authMethod === "mobile" ? "auth-method-active" : ""}
                  onClick={() => selectAuthMethod("mobile")}
                >
                  მობილურის ნომრით
                </button>
                <button
                  type="button"
                  className={authMethod === "email" ? "auth-method-active" : ""}
                  onClick={() => selectAuthMethod("email")}
                >
                  ელფოსტით
                </button>
              </div>
            )}

            {isPhonePreparation ? (
              <>
                <label className="auth-label">მობილურის ნომერი</label>
                <div
                  className={`auth-input-row ${
                    error ? "auth-input-error" : ""
                  }`}
                >
                  <span>+995</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="5XX XX XX XX"
                    value={formatGeorgianMobile(mobileNumber)}
                    onChange={(event) => {
                      setMobileNumber(
                        event.target.value.replace(/\D/g, "").slice(0, 9)
                      );
                      setError("");
                      setPhoneNotice("");
                    }}
                  />
                </div>
                {error && <div className="auth-error">{error}</div>}
                {phoneNotice && <div className="auth-notice">{phoneNotice}</div>}
                <button
                  className="auth-submit"
                  type="button"
                  onClick={handlePhonePreparation}
                >
                  კოდის მიღება
                  <span>›</span>
                </button>
              </>
            ) : (
              <>
                <label className="auth-label">
                  {emailAuth ? "ელ.ფოსტა" : "მობილურის ნომერი"}
                </label>
                <div
                  className={`auth-input-row ${
                    error ? "auth-input-error" : ""
                  }`}
                >
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
                    <button
                      type="button"
                      className="auth-inline-link"
                      onClick={openPasswordRecovery}
                    >
                      დაგავიწყდა პაროლი?
                    </button>
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
              </>
            )}
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
