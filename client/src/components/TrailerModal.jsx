import { useEffect } from 'react';
import { X } from 'lucide-react';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0` : null;
  } catch {
    return null;
  }
}

export default function TrailerModal({ trailerUrl, title, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const embedUrl = getYouTubeEmbedUrl(trailerUrl);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} Trailer`}>
      <div className="trailer-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="trailer-modal-header">
          <h3>{title} — Official Trailer</h3>
          <button className="icon-btn trailer-close-btn" onClick={onClose} aria-label="Close trailer">
            <X size={20} />
          </button>
        </div>
        <div className="trailer-video-wrapper">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="trailer-fallback">
              <p>Official trailer preview unavailable.</p>
              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  Watch on YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
