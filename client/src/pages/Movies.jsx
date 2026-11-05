import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useCity } from '../context/CityContext.jsx';
import { Empty, ErrorBox, Loader, MovieCard, useAsync } from '../components/ui.jsx';

export default function Movies() {
  const [params, setParams] = useSearchParams();
  const { citySlug, city } = useCity();
  const status = params.get('status') || 'now_showing';
  const genre = params.get('genre') || '';
  const language = params.get('language') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'popular';

  const filters = useAsync(() => api.get('/movies/filters'), []);
  const list = useAsync(
    () => api.get(`/movies${qs({ status, genre, language, q, sort, city: status === 'now_showing' ? citySlug : '' })}`),
    [status, genre, language, q, sort, citySlug],
  );

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="container section movies-page">
      <aside className="filters-panel">
        <h3>Filters</h3>
        <div className="filter-group">
          <h4>Languages</h4>
          <div className="chips">
            {filters.data?.languages.map((l) => (
              <button key={l} className={`chip ${language === l ? 'active' : ''}`} onClick={() => set('language', l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <h4>Genres</h4>
          <div className="chips">
            {filters.data?.genres.map((g) => (
              <button key={g} className={`chip ${genre === g ? 'active' : ''}`} onClick={() => set('genre', g)}>{g}</button>
            ))}
          </div>
        </div>
        {(genre || language || q) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setParams(status !== 'now_showing' ? { status } : {})}>Clear all filters</button>
        )}
      </aside>

      <section>
        <div className="section-head wrap">
          <h2>
            {q ? <>Results for “{q}”</> : status === 'coming_soon' ? 'Coming soon' : <>Movies in {city?.name || 'your city'}</>}
          </h2>
          <div className="row gap-sm">
            <div className="tabs">
              <button className={status === 'now_showing' ? 'active' : ''} onClick={() => set('status', '')}>Now showing</button>
              <button className={status === 'coming_soon' ? 'active' : ''} onClick={() => set('status', 'coming_soon')}>Coming soon</button>
            </div>
            <select value={sort} onChange={(e) => set('sort', e.target.value === 'popular' ? '' : e.target.value)} aria-label="Sort">
              <option value="popular">Popular</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
              <option value="title">A–Z</option>
            </select>
          </div>
        </div>

        {list.loading ? <Loader /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.data.movies.length === 0 ? (
          <Empty title="No movies match your filters">Try removing a filter or searching for something else.</Empty>
        ) : (
          <div className="movie-grid">
            {list.data.movies.map((m) => <MovieCard key={m.id} movie={m} />)}
          </div>
        )}
      </section>
    </div>
  );
}
