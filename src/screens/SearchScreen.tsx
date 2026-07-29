import React, { useState, useMemo } from "react";
import {
  categories,
  categoryLabels,
  categoryImages,
  georgiaCities,
} from "../data/workers";
import { WorkerCard } from "../components/WorkerCard";
import { Worker } from "../types";
import { useWorkerCatalog } from "../hooks/useWorkerCatalog";

interface SearchScreenProps {
  onWorkerSelect: (w: Worker) => void;
  initialCategory?: string;
}

type SearchSort = "rating" | "exp" | "avail" | "new" | "popular" | "price";

const searchSortOptions: Array<{ value: SearchSort; label: string }> = [
  { value: "rating", label: "შეფასება" },
  { value: "exp", label: "გამოცდილება" },
  { value: "avail", label: "ხელმისაწვდომი" },
  { value: "new", label: "ბოლოს დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price", label: "ფასი დაბლიდან" },
];

const isSearchSort = (value: string): value is SearchSort =>
  searchSortOptions.some((option) => option.value === value);

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onWorkerSelect,
  initialCategory = "all",
}) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [city, setCity] = useState("all");
  const [sortBy, setSortBy] = useState<SearchSort>("rating");
  const { workers: allWorkers, loading, error } = useWorkerCatalog();
  const cities = useMemo(
    () => ["all", ...georgiaCities],
    []
  );
  const visibleCategories = useMemo(
    () => categories.filter((cat) => cat !== "all").slice(0, 8),
    []
  );

  const filtered = useMemo(() => {
    let list = allWorkers.filter((w) => {
      const matchCat = activeCategory === "all" || w.role === activeCategory;
      const matchCity = city === "all" || w.city === city;
      const q = query.toLowerCase();
      const matchQ =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.role.toLowerCase().includes(q) ||
        w.city.toLowerCase().includes(q) ||
        w.about.toLowerCase().includes(q) ||
        w.skills.some((skill: string) => skill.toLowerCase().includes(q));
      return matchCat && matchCity && matchQ;
    });
    if (sortBy === "rating")
      list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sortBy === "exp") list = [...list].sort((a, b) => b.exp - a.exp);
    else if (sortBy === "new") list = [...list].sort((a, b) => b.id - a.id);
    else if (sortBy === "popular")
      list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sortBy === "price") {
      const getPrice = (price: string) => {
        const match = price.match(/\d+/);
        return match ? Number(match[0]) : 0;
      };
      list = [...list].sort((a, b) => getPrice(a.price) - getPrice(b.price));
    } else
      list = [...list].sort((a, b) => {
        const o = { free: 0, busy: 1, booked: 2 };
        return o[a.status] - o[b.status];
      });
    return list;
  }, [query, activeCategory, city, sortBy, allWorkers]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          padding: "30px 24px 12px",
          paddingTop: "calc(30px + var(--safe-top))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => setActiveCategory("all")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--primary)",
              fontSize: 22,
            }}
          >
            ‹
          </button>
          <div>
            <div
              style={{
                fontSize: 27,
                lineHeight: 1.05,
                fontWeight: 900,
                color: "var(--text)",
              }}
            >
              {activeCategory === "all" ? "ხელოსნები" : categoryLabels[activeCategory]}
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>
              {loading ? "იტვირთება..." : `${filtered.length} ხელოსანი`}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          ძიება
        </div>

        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 15,
            padding: "0 14px",
            marginBottom: 14,
            height: 48,
          }}
        >
          <span style={{ fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input
            type="text"
            placeholder="სახელი, სპეციალობა ან ქალაქი..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              color: "var(--text)",
              fontSize: 14,
              padding: "0",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                background: "none",
                color: "var(--text3)",
                fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="search-category-strip">
          <button
            type="button"
            className={activeCategory === "all" ? "active" : ""}
            onClick={() => setActiveCategory("all")}
          >
            ყველა
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? "active" : ""}
              onClick={() => setActiveCategory(cat)}
            >
              {categoryImages[cat] && <img src={categoryImages[cat]} alt="" />}
              <span>{categoryLabels[cat]}</span>
            </button>
          ))}
        </div>

        <div className="search-filter-grid">
          <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>
            კატეგორია
            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              style={{
                width: "100%",
                height: 42,
                marginTop: 6,
                padding: "0 8px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                background: "white",
                color: "var(--text)",
                border: "1px solid var(--border)",
                appearance: "auto",
                textOverflow: "ellipsis",
              }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabels[cat]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>
            ქალაქი
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              style={{
                width: "100%",
                height: 42,
                marginTop: 6,
                padding: "0 8px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                background: "white",
                color: "var(--text)",
                border: "1px solid var(--border)",
                appearance: "auto",
                textOverflow: "ellipsis",
              }}
            >
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "ყველა" : item}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>
            დალაგება
            <select
              value={sortBy}
              onChange={(event) => {
                if (isSearchSort(event.target.value)) {
                  setSortBy(event.target.value);
                }
              }}
              style={{
                width: "100%",
                height: 42,
                marginTop: 6,
                padding: "0 8px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                background: "white",
                color: "var(--text)",
                border: "1px solid var(--border)",
                appearance: "auto",
                textOverflow: "ellipsis",
              }}
            >
              {searchSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Results */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 24px",
          paddingBottom: 90,
        }}
      >
        {error && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              color: "#9a3412",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.4,
              marginBottom: 12,
              padding: "10px 12px",
            }}
          >
            რეალური სია ვერ ჩაიტვირთა, ნაჩვენებია demo მონაცემები.
          </div>
        )}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((item) => (
              <div key={item} className="worker-card-skeleton">
                <div />
                <section>
                  <span />
                  <span />
                  <span />
                </section>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              ვერ მოიძებნა
            </div>
            <div style={{ fontSize: 13, color: "var(--text3)" }}>
              სხვა საძიებო სიტყვა სცადეთ
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((w, i) => (
              <WorkerCard
                key={w.id}
                worker={w}
                onClick={() => onWorkerSelect(w)}
                delay={i * 60}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
