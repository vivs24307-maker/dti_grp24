export function MovieCardSkeleton() {
  return (
    <div className="skeleton-movie-card">
      <div className="skeleton-poster skeleton-shimmer" />
      <div className="skeleton-line-title skeleton-shimmer" />
      <div className="skeleton-line-sub skeleton-shimmer" />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="skeleton-hero">
      <div className="container skeleton-hero-inner">
        <div className="skeleton-hero-poster skeleton-shimmer" />
        <div className="skeleton-hero-copy">
          <div className="skeleton-line-pill skeleton-shimmer" />
          <div className="skeleton-line-h1 skeleton-shimmer" />
          <div className="skeleton-line-desc skeleton-shimmer" />
          <div className="skeleton-line-btn skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function SectionSkeleton({ count = 6, title = "Loading Movies..." }) {
  return (
    <section className="container section">
      <div className="section-head">
        <div className="skeleton-line-h2 skeleton-shimmer" />
      </div>
      <div className="scroller">
        {Array.from({ length: count }).map((_, i) => (
          <MovieCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
