import React, { useEffect, useMemo, useState } from "react";
import {
  categoryGroups,
  categoryLabels,
  georgiaCities,
  getCategoryById,
  getSearchSuggestions,
  getServiceSelectionLabel,
  makeServiceSelection,
  sanitizeWorkerProfessions,
  workerMatchesService,
} from "../data/workers";
import { WorkerCard } from "../components/WorkerCard";
import { EmptyState } from "../components/EmptyState";
import { WorkerCardSkeletonList } from "../components/Skeletons";
import { Worker } from "../types";
import { useWorkerCatalog } from "../hooks/useWorkerCatalog";

interface SearchScreenProps {
  onWorkerSelect: (worker: Worker) => void;
  onBack: () => void;
  initialCategory?: string;
}

type SearchSort = "rating" | "exp" | "avail" | "new" | "popular" | "price";

const sortOptions: Array<{ value: SearchSort; label: string }> = [
  { value: "rating", label: "შეფასება" },
  { value: "exp", label: "გამოცდილება" },
  { value: "avail", label: "ხელმისაწვდომი" },
  { value: "new", label: "ბოლოს დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price", label: "ფასი დაბლიდან" },
];

const isSearchSort = (value: string): value is SearchSort =>
  sortOptions.some((option) => option.value === value);

const searchScreenStyles = `
  .search-screen-header { padding: calc(28px + var(--safe-top)) 20px 18px; }
  .search-screen-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .search-screen-back { flex: 0 0 42px; width: 42px; height: 42px; border: 1px solid var(--border); border-radius: 12px; background: white; color: var(--primary); font-size: 24px; line-height: 1; }
  .search-screen-title { min-width: 0; font-size: 26px; line-height: 1.2; font-weight: 900; color: var(--text); overflow-wrap: anywhere; }
  .search-screen-count { margin-top: 4px; font-size: 13px; line-height: 1.35; color: var(--text2); }
  .search-screen-question { margin: 0 0 10px; font-size: 18px; line-height: 1.3; font-weight: 900; color: var(--text); }
  .search-screen-query { position: relative; }
  .search-screen-query-field { display: flex; align-items: center; min-height: 52px; gap: 10px; padding: 0 14px; border: 1px solid var(--border); border-radius: 14px; background: white; }
  .search-screen-query-icon { flex: 0 0 auto; font-size: 18px; line-height: 1; color: var(--text3); }
  .search-screen-query-input { width: 100%; min-width: 0; height: 50px; border: 0; background: transparent; color: var(--text); font-size: 15px; line-height: 1.3; font-weight: 700; }
  .search-screen-query-input::placeholder { color: var(--text3); opacity: 1; }
  .search-screen-clear { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 8px; background: transparent; color: var(--text3); font-size: 19px; line-height: 1; }
  .search-screen-suggestions { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; right: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: var(--shadow-sm); }
  .search-screen-suggestion { display: block; width: 100%; min-height: 54px; padding: 9px 14px; border-bottom: 1px solid var(--border); background: white; color: var(--text); text-align: left; }
  .search-screen-suggestion:last-child { border-bottom: 0; }
  .search-screen-suggestion strong { display: block; font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
  .search-screen-suggestion span { display: block; margin-top: 2px; color: var(--text2); font-size: 12px; line-height: 1.3; font-weight: 700; }
  .search-screen-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; margin-top: 16px; }
  .search-screen-filter { display: block; min-width: 0; color: var(--text2); font-size: 13px; line-height: 1.35; font-weight: 800; }
  .search-screen-filter--wide { grid-column: 1 / -1; }
  .search-screen-filter select { display: block; width: 100%; height: 52px; margin-top: 6px; padding: 0 42px 0 13px; border: 1px solid var(--border); border-radius: 12px; background-color: white; color: var(--text); font-size: 14px; line-height: 1.3; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
  .search-screen-filter select:disabled { color: var(--text3); opacity: 1; background-color: var(--bg); }
  .search-screen-results { flex: 1; overflow-y: auto; padding: 4px 20px calc(90px + var(--safe-bottom)); }
  @media (max-width: 374px) {
    .search-screen-header { padding-left: 16px; padding-right: 16px; }
    .search-screen-results { padding-left: 16px; padding-right: 16px; }
    .search-screen-title { font-size: 24px; }
    .search-screen-filters { grid-template-columns: 1fr; }
    .search-screen-filter { grid-column: 1 / -1; }
  }
`;

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onWorkerSelect,
  onBack,
  initialCategory = "all",
}) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [city, setCity] = useState("all");
  const [sortBy, setSortBy] = useState<SearchSort>("rating");
  const { workers: allWorkers, loading, error } = useWorkerCatalog();
  const suggestions = useMemo(() => getSearchSuggestions(query), [query]);
  const selectedCategory = getCategoryById(activeCategory);

  useEffect(() => {
    setActiveCategory(initialCategory);
    setSelectedSubcategory("");
  }, [initialCategory]);

  const filtered = useMemo(() => {
    const serviceFilter = selectedSubcategory || activeCategory;
    let list = allWorkers.filter((worker) => {
      const values = sanitizeWorkerProfessions([worker.role, ...worker.skills]);
      const matchService =
        serviceFilter === "all" || workerMatchesService(values, serviceFilter);
      const matchCity = city === "all" || worker.city === city;
      const text = [
        worker.name,
        worker.city,
        worker.about,
        ...values.map(getServiceSelectionLabel),
      ]
        .join(" ")
        .toLocaleLowerCase("ka-GE");
      const matchQuery =
        !query ||
        text.includes(query.toLocaleLowerCase("ka-GE")) ||
        suggestions.some((item) =>
          workerMatchesService(
            values,
            makeServiceSelection(item.categoryId, item.subcategory)
          )
        );
      return matchService && matchCity && matchQuery;
    });

    if (sortBy === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sortBy === "exp") list = [...list].sort((a, b) => b.exp - a.exp);
    else if (sortBy === "new") list = [...list].sort((a, b) => b.id - a.id);
    else if (sortBy === "popular") {
      list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    } else if (sortBy === "price") {
      const price = (value: string) => Number(value.match(/\d+/)?.[0] || 0);
      list = [...list].sort((a, b) => price(a.price) - price(b.price));
    } else {
      const availability = { free: 0, busy: 1, booked: 2 } as const;
      list = [...list].sort(
        (a, b) => availability[a.status] - availability[b.status]
      );
    }

    return list;
  }, [
    activeCategory,
    allWorkers,
    city,
    query,
    selectedSubcategory,
    sortBy,
    suggestions,
  ]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <style>{searchScreenStyles}</style>
      <div className="search-screen-header">
        <div className="search-screen-title-row">
          <button
            type="button"
            aria-label="უკან"
            onClick={onBack}
            className="search-screen-back"
          >
            ‹
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="search-screen-title">
              {activeCategory === "all"
                ? "ხელოსნების ძიება"
                : categoryLabels[activeCategory]}
            </div>
            <div className="search-screen-count">
              {loading ? "იტვირთება..." : `${filtered.length} ხელოსანი`}
            </div>
          </div>
        </div>

        <div className="search-screen-question">რა გჭირდება?</div>
        <div className="search-screen-query">
          <div className="search-screen-query-field">
            <span className="search-screen-query-icon">⌕</span>
            <input
              type="text"
              className="search-screen-query-input"
              placeholder="ელექტრიკოსი, ონკანი, კაფელი..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="ძიების გასუფთავება"
                className="search-screen-clear"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </div>

          {query && suggestions.length > 0 && (
            <div className="search-screen-suggestions">
              {suggestions.map((item) => (
                <button
                  key={`${item.categoryId}-${item.subcategory}`}
                  type="button"
                  className="search-screen-suggestion"
                  onClick={() => {
                    setActiveCategory(item.categoryId);
                    setSelectedSubcategory(
                      makeServiceSelection(item.categoryId, item.subcategory)
                    );
                    setQuery("");
                  }}
                >
                  <strong>{item.subcategory}</strong>
                  <span>{item.categoryLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="search-screen-filters">
          <label className="search-screen-filter search-screen-filter--wide">
            კატეგორია
            <select
              value={activeCategory}
              onChange={(event) => {
                setActiveCategory(event.target.value);
                setSelectedSubcategory("");
              }}
            >
              <option value="all">ყველა კატეგორია</option>
              {categoryGroups.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="search-screen-filter search-screen-filter--wide">
            კონკრეტული სამუშაო
            <select
              disabled={!selectedCategory}
              value={selectedSubcategory}
              onChange={(event) => setSelectedSubcategory(event.target.value)}
            >
              <option value="">
                {selectedCategory ? "ყველა სამუშაო" : "ჯერ აირჩიე კატეგორია"}
              </option>
              {selectedCategory?.subcategories.map((subcategory) => (
                <option
                  key={subcategory.label}
                  value={makeServiceSelection(
                    selectedCategory.id,
                    subcategory.label
                  )}
                >
                  {subcategory.label}
                </option>
              ))}
            </select>
          </label>

          <label className="search-screen-filter">
            ქალაქი
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="all">ყველა ქალაქი</option>
              {georgiaCities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="search-screen-filter">
            დალაგება
            <select
              value={sortBy}
              onChange={(event) => {
                if (isSearchSort(event.target.value)) {
                  setSortBy(event.target.value);
                }
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="search-screen-results">
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
          <WorkerCardSkeletonList />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="⌕"
            title="ხელოსანი ვერ მოიძებნა"
            description="სცადე სხვა საძიებო სიტყვა, ქალაქი ან კატეგორია."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((worker, index) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onClick={() => onWorkerSelect(worker)}
                delay={index * 60}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
