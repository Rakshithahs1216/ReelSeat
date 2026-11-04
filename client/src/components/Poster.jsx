import { useState } from 'react';

/** Movie poster with a graceful fallback (initial letter) when the image is missing or fails to load. */
export default function Poster({ src, title, size = '', alt = '', children }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={`poster${size ? ` poster-${size}` : ''}`}>
      {showImage ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="poster-fallback" aria-hidden="true">{title?.[0] ?? '?'}</span>
      )}
      {children}
    </div>
  );
}
