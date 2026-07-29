import React from "react";
import {
  categories,
  categoryLabels,
  categoryIcons,
  categoryImages,
} from "../data/workers";
import { WorkerCard } from "../components/WorkerCard";
import { Worker } from "../types";
import { useWorkerCatalog } from "../hooks/useWorkerCatalog";
import { EmptyState } from "../components/EmptyState";
import { WorkerCardSkeletonList } from "../components/Skeletons";

interface HomeScreenProps {
  onWorkerSelect: (w: Worker) => void;
  onCategorySelect: (cat: string) => void;
}

const heroImage =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&auto=format&fit=crop";

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onWorkerSelect,
  onCategorySelect,
}) => {
  const { workers, loading } = useWorkerCatalog();
  const topWorkers = [...workers]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  const topWorkerIds = new Set(topWorkers.map((worker) => worker.id));
  const allWorkers = [...workers]
    .filter((worker) => !topWorkerIds.has(worker.id))
    .sort((a, b) => b.rating - a.rating);
  const visibleCategories = categories
    .filter((cat) => cat !== "all")
    .slice(0, 8);

  return (
    <div className="home-page">
      <div className="home-hero">
        <img src={heroImage} alt="" />
        <div />
        <h1>იპოვე ხელოსანი რამდენიმე წამში</h1>
      </div>

      <button className="home-search" onClick={() => onCategorySelect("all")}>
        <span>⌕</span>
        <span>ძებნა სახელით...</span>
      </button>

      <section className="home-section">
        <h2>კატეგორიები</h2>
        <div className="home-categories">
          {visibleCategories.map((cat) => (
            <button key={cat} onClick={() => onCategorySelect(cat)}>
              <span>
                {categoryImages[cat] ? (
                  <img src={categoryImages[cat]} alt="" />
                ) : (
                  categoryIcons[cat]
                )}
              </span>
              <small>{categoryLabels[cat]}</small>
            </button>
          ))}
          <button onClick={() => onCategorySelect("all")}>
            <span>
              <img src={categoryImages.all} alt="" />
            </span>
            <small>ყველა კატეგორია</small>
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-title-row">
          <h2>{loading ? "იტვირთება" : "რეკომენდებული"}</h2>
          {!loading && topWorkers.length > 0 && (
            <button onClick={() => onCategorySelect("all")}>ყველას ნახვა</button>
          )}
        </div>
        <div className="home-workers">
          {loading ? (
            <WorkerCardSkeletonList count={3} />
          ) : topWorkers.length > 0 ? (
            topWorkers.map((worker, index) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onClick={() => onWorkerSelect(worker)}
                delay={index * 70}
              />
            ))
          ) : (
            <EmptyState
              compact
              title="რეკომენდაციები ჯერ არ არის"
              description="როგორც კი შეფასებული ხელოსნები დაემატება, აქ საუკეთესოები გამოჩნდება."
            />
          )}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-title-row">
          <h2>ყველა ხელოსანი</h2>
          {allWorkers.length > 3 && (
            <button onClick={() => onCategorySelect("all")}>ძიება</button>
          )}
        </div>
        <div className="home-workers">
          {loading ? (
            <WorkerCardSkeletonList count={3} />
          ) : allWorkers.length > 0 ? (
            allWorkers.map((worker, index) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onClick={() => onWorkerSelect(worker)}
                delay={index * 40}
              />
            ))
          ) : (
            <EmptyState
              compact
              title="ხელოსნები ჯერ არ ჩანს"
              description="ძიებაში შეგიძლია კატეგორიის ან ქალაქის მიხედვით გადაამოწმო."
              actionLabel="ძიებაში გადასვლა"
              onAction={() => onCategorySelect("all")}
            />
          )}
        </div>
      </section>

    </div>
  );
};
