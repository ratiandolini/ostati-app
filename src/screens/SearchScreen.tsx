import React, { useEffect, useMemo, useState } from "react";
import { categoryGroups, categoryLabels, georgiaCities, getCategoryById, getSearchSuggestions, makeServiceSelection, workerMatchesService } from "../data/workers";
import { WorkerCard } from "../components/WorkerCard";
import { EmptyState } from "../components/EmptyState";
import { WorkerCardSkeletonList } from "../components/Skeletons";
import { Worker } from "../types";
import { useWorkerCatalog } from "../hooks/useWorkerCatalog";

interface SearchScreenProps { onWorkerSelect: (worker: Worker) => void; onBack: () => void; initialCategory?: string; }
type SearchSort = "rating" | "exp" | "avail" | "new" | "popular" | "price";
const sortOptions: Array<{ value: SearchSort; label: string }> = [{ value: "rating", label: "შეფასება" }, { value: "exp", label: "გამოცდილება" }, { value: "avail", label: "ხელმისაწვდომი" }, { value: "new", label: "ბოლოს დამატებული" }, { value: "popular", label: "პოპულარული" }, { value: "price", label: "ფასი დაბლიდან" }];
const isSearchSort = (value: string): value is SearchSort => sortOptions.some((option) => option.value === value);
const selectStyle: React.CSSProperties = { width: "100%", height: 42, marginTop: 6, padding: "0 8px", borderRadius: 12, fontSize: 12, fontWeight: 800, background: "white", color: "var(--text)", border: "1px solid var(--border)", appearance: "auto" };

export const SearchScreen: React.FC<SearchScreenProps> = ({ onWorkerSelect, onBack, initialCategory = "all" }) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [city, setCity] = useState("all");
  const [sortBy, setSortBy] = useState<SearchSort>("rating");
  const { workers: allWorkers, loading, error } = useWorkerCatalog();
  const suggestions = useMemo(() => getSearchSuggestions(query), [query]);
  const selectedCategory = getCategoryById(activeCategory);
  useEffect(() => { setActiveCategory(initialCategory); setSelectedSubcategory(""); }, [initialCategory]);

  const filtered = useMemo(() => {
    const serviceFilter = selectedSubcategory || activeCategory;
    let list = allWorkers.filter((worker) => {
      const values = [worker.role, ...worker.skills];
      const matchService = serviceFilter === "all" || workerMatchesService(values, serviceFilter);
      const matchCity = city === "all" || worker.city === city;
      const text = [worker.name, worker.role, worker.city, worker.about, ...worker.skills].join(" ").toLocaleLowerCase("ka-GE");
      const matchQuery = !query || text.includes(query.toLocaleLowerCase("ka-GE")) || suggestions.some((item) => workerMatchesService(values, makeServiceSelection(item.categoryId, item.subcategory)));
      return matchService && matchCity && matchQuery;
    });
    if (sortBy === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sortBy === "exp") list = [...list].sort((a, b) => b.exp - a.exp);
    else if (sortBy === "new") list = [...list].sort((a, b) => b.id - a.id);
    else if (sortBy === "popular") list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sortBy === "price") { const price = (value: string) => Number(value.match(/\d+/)?.[0] || 0); list = [...list].sort((a, b) => price(a.price) - price(b.price)); }
    else {
      const availability = { free: 0, busy: 1, booked: 2 } as const;
      list = [...list].sort((a, b) => availability[a.status] - availability[b.status]);
    }
    return list;
  }, [activeCategory, allWorkers, city, query, selectedSubcategory, sortBy, suggestions]);

  return <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
    <div style={{ padding: "30px 24px 12px", paddingTop: "calc(30px + var(--safe-top))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}><button aria-label="უკან" onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--border)", background: "white", color: "var(--primary)", fontSize: 22 }}>‹</button><div><div style={{ fontSize: 27, lineHeight: 1.05, fontWeight: 900, color: "var(--text)" }}>{activeCategory === "all" ? "ხელოსნების ძიება" : categoryLabels[activeCategory]}</div><div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>{loading ? "იტვირთება..." : `${filtered.length} ხელოსანი`}</div></div></div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", marginBottom: 12 }}>რა გჭირდება?</div>
      <div style={{ position: "relative" }}><div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: "1px solid var(--border)", borderRadius: 15, padding: "0 14px", height: 48 }}><span style={{ fontSize: 16, opacity: .5 }}>⌕</span><input type="text" placeholder="მაგ: ელექტრიკოსი, კაფელი, ონკანი..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, background: "transparent", color: "var(--text)", fontSize: 14, padding: 0 }} />{query && <button aria-label="ძიების გასუფთავება" onClick={() => setQuery("")} style={{ background: "none", color: "var(--text3)", fontSize: 16 }}>×</button>}</div>
        {query && suggestions.length > 0 && <div style={{ position: "absolute", zIndex: 5, top: 52, left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 24px rgba(15, 23, 42, .12)", overflow: "hidden" }}>{suggestions.map((item) => <button key={`${item.categoryId}-${item.subcategory}`} type="button" onClick={() => { setActiveCategory(item.categoryId); setSelectedSubcategory(makeServiceSelection(item.categoryId, item.subcategory)); setQuery(""); }} style={{ display: "block", width: "100%", minHeight: 48, padding: "8px 12px", textAlign: "left", background: "white", color: "var(--text)", borderBottom: "1px solid var(--border)" }}><strong style={{ display: "block", fontSize: 13 }}>{item.subcategory}</strong><span style={{ display: "block", marginTop: 2, color: "var(--text2)", fontSize: 11, fontWeight: 800 }}>{item.categoryLabel}</span></button>)}</div>}
      </div>
      <div className="search-filter-grid" style={{ marginTop: 14 }}>
        <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>კატეგორია<select value={activeCategory} onChange={(event) => { setActiveCategory(event.target.value); setSelectedSubcategory(""); }} style={selectStyle}><option value="all">ყველა კატეგორია</option>{categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
        <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>კონკრეტული სამუშაო<select disabled={!selectedCategory} value={selectedSubcategory} onChange={(event) => setSelectedSubcategory(event.target.value)} style={{ ...selectStyle, opacity: selectedCategory ? 1 : .6 }}><option value="">{selectedCategory ? "ყველა სამუშაო" : "ჯერ აირჩიე კატეგორია"}</option>{selectedCategory?.subcategories.map((subcategory) => <option key={subcategory.label} value={makeServiceSelection(selectedCategory.id, subcategory.label)}>{subcategory.label}</option>)}</select></label>
        <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>ქალაქი<select value={city} onChange={(event) => setCity(event.target.value)} style={selectStyle}><option value="all">ყველა ქალაქი</option>{georgiaCities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label style={{ fontSize: 10, color: "var(--text3)", fontWeight: 900 }}>დალაგება<select value={sortBy} onChange={(event) => { if (isSearchSort(event.target.value)) setSortBy(event.target.value); }} style={selectStyle}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px", paddingBottom: 90 }}>
      {error && <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, color: "#9a3412", fontSize: 12, fontWeight: 700, lineHeight: 1.4, marginBottom: 12, padding: "10px 12px" }}>რეალური სია ვერ ჩაიტვირთა, ნაჩვენებია demo მონაცემები.</div>}
      {loading ? <WorkerCardSkeletonList /> : filtered.length === 0 ? <EmptyState icon="⌕" title="ხელოსანი ვერ მოიძებნა" description="სცადე სხვა საძიებო სიტყვა, ქალაქი ან კატეგორია." /> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{filtered.map((worker, index) => <WorkerCard key={worker.id} worker={worker} onClick={() => onWorkerSelect(worker)} delay={index * 60} />)}</div>}
    </div>
  </div>;
};
