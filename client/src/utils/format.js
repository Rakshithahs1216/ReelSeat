const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatPrice = (n) => currency.format(n);

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const formatDuration = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

export const isPast = (iso) => new Date(iso) <= new Date();

export const rowLabel = (i) => String.fromCharCode(65 + i);

/** Converts a value from <input type="datetime-local"> (local time) into an ISO string. */
export const localInputToIso = (value) => new Date(value).toISOString();
