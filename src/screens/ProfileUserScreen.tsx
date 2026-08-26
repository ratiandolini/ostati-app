import React, { useEffect, useRef, useState } from "react";
import { User } from "../types";
import { georgiaCities } from "../data/workers";
import { dataService, isDemoDataMode } from "../services/dataService";
import {
  loadCurrentUserProfile,
  saveCurrentUserProfile,
  uploadProfilePhoto,
} from "../services/profileApiService";
import { loadMyClientPoints } from "../services/reviewApiService";
import { mergeClientPointsWithLocalAwards } from "../services/clientPointsCache";
import { clientProfileSchema, getValidationMessage } from "../services/validation";
import { reportApiError } from "../services/apiErrorUtils";
import { ReferralPanel } from "../components/ReferralPanel";

interface ProfileUserScreenProps {
  user: User;
  onLogout: () => void;
  onProfileUpdated?: (profile: {
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
  }) => void;
}

export const ProfileUserScreen: React.FC<ProfileUserScreenProps> = ({
  user,
  onLogout,
  onProfileUpdated,
}) => {
  const [clientRating, setClientRating] = useState(() => {
    if (!isDemoDataMode) return { value: 0, count: 0 };
    const profile = dataService.getClientProfile(user.phone);
    return profile.rating || dataService.getClientRating(user.phone);
  });
  const [clientPoints, setClientPoints] = useState(() =>
    isDemoDataMode
      ? dataService.getClientPoints(user.phone)
      : { total: 0, history: [] }
  );
  const [clientReviews, setClientReviews] = useState(() =>
    isDemoDataMode ? dataService.getClientReviews(user.phone) : []
  );
  const [photo, setPhoto] = useState<string | null>(() => {
    if (!isDemoDataMode) return null;
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.photo === "string" ? profile.photo : null;
  });
  const [firstName, setFirstName] = useState(() => {
    if (!isDemoDataMode) return "";
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.firstName === "string" && profile.firstName
      ? profile.firstName
      : "Testi";
  });
  const [lastName, setLastName] = useState(() => {
    if (!isDemoDataMode) return "";
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.lastName === "string" && profile.lastName
      ? profile.lastName
      : "Testi";
  });
  const [contactPhone, setContactPhone] = useState(() => {
    if (!isDemoDataMode) return "";
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.contactPhone === "string"
      ? profile.contactPhone
      : user.phone.includes("@")
        ? ""
        : user.phone;
  });
  const [city, setCity] = useState(() => {
    if (!isDemoDataMode) return "თბილისი";
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.city === "string" && profile.city
      ? profile.city
      : "თბილისი";
  });
  const [address, setAddress] = useState(() => {
    if (!isDemoDataMode) return "";
    const profile = dataService.getClientProfile(user.phone);
    return typeof profile.address === "string" ? profile.address : "";
  });
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const profileSnapshot = JSON.stringify({
    firstName,
    lastName,
    contactPhone,
    city,
    address,
    photo,
  });
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(profileSnapshot);
  const profileChanged = profileSnapshot !== savedProfileSnapshot;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || "კლიენტი";
  const contactLabel = user.phone.includes("@")
    ? user.phone
    : `+995 ${user.phone}`;

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    const controller = new AbortController();
    setUploadError("");
    const loadProfile = () =>
      Promise.all([
      loadCurrentUserProfile(controller.signal),
      loadMyClientPoints().catch(() => ({ total: 0, history: [] })),
    ])
      .then(([profile, points]) => {
        if (cancelled || !profile) return;
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setContactPhone(profile.contact_phone || "");
        setCity(profile.city || "თბილისი");
        setAddress(profile.address_text || "");
        setPhoto(profile.photo_url || null);
        setSavedProfileSnapshot(
          JSON.stringify({
            firstName: profile.first_name || "",
            lastName: profile.last_name || "",
            contactPhone: profile.contact_phone || "",
            city: profile.city || "თბილისი",
            address: profile.address_text || "",
            photo: profile.photo_url || null,
          })
        );
        setClientRating({
          value: Number(profile.rating_avg || 0),
          count: profile.rating_count || 0,
        });
        setClientPoints(mergeClientPointsWithLocalAwards(user.phone, points));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        reportApiError(error, { silentTransient: true });
      });

    loadProfile();
    window.addEventListener("client-points-updated", loadProfile);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("client-points-updated", loadProfile);
    };
  }, [user.phone]);

  useEffect(() => {
    if (!isDemoDataMode) return;
    setClientRating(dataService.getClientRating(user.phone));
    setClientPoints(dataService.getClientPoints(user.phone));
    setClientReviews(dataService.getClientReviews(user.phone));
  }, [user.phone]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError("");

    if (!isDemoDataMode) {
      setSaving(true);
      try {
        const uploaded = await uploadProfilePhoto(file, "client");
        setPhoto(uploaded.publicUrl);
        await saveCurrentUserProfile({
          firstName,
          lastName,
          contactPhone,
          photoUrl: uploaded.publicUrl,
          city,
          addressText: address,
        });
        onProfileUpdated?.({ firstName, lastName, photoUrl: uploaded.publicUrl });
        setSavedProfileSnapshot(
          JSON.stringify({
            firstName,
            lastName,
            contactPhone,
            city,
            address,
            photo: uploaded.publicUrl,
          })
        );
        setSaveMessage("ფოტო შენახულია");
      } catch (error) {
        setUploadError("ფოტოს ატვირთვა ვერ მოხერხდა. გადაამოწმე Supabase Storage წესები.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setUploadError("");
    setSaveMessage("");

    const validation = clientProfileSchema.safeParse({
      firstName,
      lastName,
      contactPhone,
      city,
      address,
    });

    if (!validation.success) {
      setUploadError(getValidationMessage(validation.error, "პროფილის მონაცემები გადაამოწმეთ"));
      return;
    }

    if (isDemoDataMode) {
      dataService.saveClientProfile(user.phone, {
        firstName,
        lastName,
        contactPhone,
        city,
        address,
        photo,
        rating: dataService.getClientRating(user.phone),
      });
      setSavedProfileSnapshot(profileSnapshot);
      setSaveMessage("პროფილი შენახულია");
      return;
    }

    setSaving(true);
    try {
      await saveCurrentUserProfile({
        firstName,
        lastName,
        contactPhone,
        photoUrl: photo,
        city,
        addressText: address,
      });
      onProfileUpdated?.({ firstName, lastName, photoUrl: photo });
      setSavedProfileSnapshot(profileSnapshot);
      setSaveMessage("პროფილი შენახულია");
    } catch (error) {
      setUploadError("პროფილის შენახვა ვერ მოხერხდა. სცადე თავიდან.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "34px 28px 100px",
        background: "var(--bg)",
      }}
    >
      <h2 className="screen-title">პროფილი</h2>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 104,
            height: 104,
            margin: "0 auto 18px",
            borderRadius: "50%",
            overflow: "hidden",
            background: "#c93305",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt="კლიენტის ფოტო"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            firstName.charAt(0).toUpperCase()
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
          {fullName}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 6,
            color: "#f59e0b",
            fontSize: 14,
            fontWeight: 900,
          }}
          >
          <span>{"★".repeat(Math.max(1, Math.round(clientRating.value)))}</span>
          <span style={{ color: "var(--text)", fontSize: 12 }}>
            {clientRating.value.toFixed(1)}
          </span>
          <span style={{ color: "var(--text2)", fontSize: 12 }}>
            ({clientRating.count})
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 14, color: "var(--text2)" }}>
          {contactLabel}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 14,
            padding: "10px 16px",
            borderRadius: 12,
            background: "var(--primary)",
            color: "white",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          {photo ? "ფოტოს შეცვლა" : "ფოტოს დამატება"}
        </button>
        {saving && (
          <div style={{ marginTop: 8, color: "var(--text2)", fontSize: 12, fontWeight: 800 }}>
            იტვირთება...
          </div>
        )}
        {uploadError && (
          <div style={{ marginTop: 8, color: "#dc2626", fontSize: 12, fontWeight: 800 }}>
            {uploadError}
          </div>
        )}
      </div>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 16,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
        }}
      >
        <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 900 }}>
          ქულები
        </div>
        <div
          style={{
            marginTop: 6,
            color: "var(--text)",
            fontSize: 30,
            lineHeight: 1,
            fontWeight: 900,
          }}
        >
          {clientPoints.total}
        </div>
        <div
          style={{
            marginTop: 7,
            color: "var(--text2)",
            fontSize: 12,
            lineHeight: 1.45,
            fontWeight: 750,
          }}
        >
          {clientPoints.history[0]
            ? `ბოლო დარიცხვა: ${clientPoints.history[0].reason}`
            : "შეაფასე დასრულებული ჯავშანი და მიიღე ქულები"}
        </div>
        {clientPoints.history.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {clientPoints.history.slice(0, 3).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "white",
                  color: "var(--text)",
                  fontSize: 11,
                  fontWeight: 850,
                }}
              >
                <span style={{ color: "var(--text2)", lineHeight: 1.35 }}>
                  {item.reason}
                </span>
                <strong style={{ color: "#1d4ed8", flexShrink: 0 }}>
                  +{item.points}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 16,
          background: "white",
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900 }}>
          ჩემი რეიტინგი
        </h3>
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 950 }}>
            ★ {clientRating.value.toFixed(1)}
            <span style={{ color: "var(--text2)", fontSize: 13, marginLeft: 6 }}>
              ({clientRating.count})
            </span>
          </div>
        </div>
        {clientReviews.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {clientReviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                style={{
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "#f8fafc",
                  color: "var(--text2)",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1.4,
                }}
              >
                ★ {review.overall.toFixed(1)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 10, color: "var(--text3)", fontSize: 12, lineHeight: 1.45, fontWeight: 750 }}>
            შეფასებები გამოჩნდება დასრულებული სამუშაოების შემდეგ.
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900 }}>
          პირადი ინფორმაცია
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "სახელი", value: firstName, set: setFirstName },
            { label: "გვარი", value: lastName, set: setLastName },
          ].map((field) => (
            <label
              key={field.label}
              style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}
            >
              {field.label}
              <input
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                style={{
                  width: "100%",
                  height: 46,
                  marginTop: 7,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              />
            </label>
          ))}
        </div>
        <label
          style={{
            display: "block",
            marginTop: 12,
            color: "var(--text2)",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          მობილური
          <input
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="მაგ: 555 12 34 56"
            style={{
              width: "100%",
              height: 46,
              marginTop: 7,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 800,
            }}
          />
        </label>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900 }}>
          საცხოვრებელი მისამართი
        </h3>
        <label
          style={{
            display: "block",
            color: "var(--text2)",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          ქალაქი
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            style={{
              width: "100%",
              height: 46,
              marginTop: 7,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            {georgiaCities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "block",
            marginTop: 12,
            color: "var(--text2)",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          მისამართი
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="მაგ: ვაკე, ჭავჭავაძის 12"
            style={{
              width: "100%",
              height: 46,
              marginTop: 7,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 800,
            }}
          />
        </label>
        <div
          style={{
            marginTop: 9,
            color: "var(--text3)",
            fontSize: 12,
            lineHeight: 1.45,
            fontWeight: 700,
          }}
        >
          ეს მისამართი შენს პროფილში ინახება. კონკრეტული ჯავშნის მისამართს
          ხელოსნის დაჯავშნისას მიუთითებ.
        </div>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving || !profileChanged}
          style={{
            width: "100%",
            minHeight: 48,
            marginTop: 14,
            borderRadius: 13,
            background: saving || !profileChanged ? "#dbe4ef" : "var(--primary)",
            color: "white",
            opacity: saving || !profileChanged ? 0.75 : 1,
            fontSize: 14,
            fontWeight: 950,
          }}
        >
          {saving ? "ინახება..." : profileChanged ? "შენახვა" : "შენახულია"}
        </button>
        {saveMessage && (
          <div
            style={{
              marginTop: 9,
              color: "#047857",
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            {saveMessage}
          </div>
        )}
      </section>

      <ReferralPanel roleLabel="მეგობარი" />

      <button
        onClick={onLogout}
        style={{
          width: "100%",
          minHeight: 58,
          marginTop: 28,
          padding: "0 16px",
          borderRadius: 14,
          background: "white",
          color: "#ef4444",
          border: "1px solid var(--border)",
          fontSize: 15,
          fontWeight: 900,
          textAlign: "left",
        }}
      >
        ⇱ გასვლა
      </button>
    </div>
  );
};
