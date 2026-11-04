import { useState } from 'react';

/** Movie poster with a graceful fallback (initial letter) when the image is missing or fails to load. */
export default function Poster({ src, title, size = '', alt = '', children }) {
  const [failed, setFailed] = useState(false);
  // The fallback is always rendered underneath so slow/unreachable images never leave a blank box.
  return (
    <div className={`poster${size ? ` poster-${size}` : ''}`}>
      <span className="poster-fallback" aria-hidden="true">{title?.[0] ?? '?'}</span>
      {src && !failed && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
      {children}
    </div>
  );
}
