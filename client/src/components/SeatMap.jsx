import { rowLabel } from '../utils/format';

/**
 * Renders a theatre seat grid.
 * - `booked`: seats taken by other bookings (disabled)
 * - `selected`: seats currently chosen by the user
 * - `max`: maximum number of seats that can be selected
 */
export default function SeatMap({ rows, cols, booked = [], selected = [], onToggle, max = 10 }) {
  const bookedSet = new Set(booked);
  const selectedSet = new Set(selected);
  const atLimit = selected.length >= max;
  const aisleAfter = cols > 8 ? Math.floor(cols / 2) : null;

  return (
    <div className="seatmap">
      <div className="screen" aria-hidden="true">SCREEN THIS WAY</div>
      <div className="seat-grid" role="grid" aria-label="Seat map">
        {Array.from({ length: rows }, (_, r) => {
          const row = rowLabel(r);
          return (
            <div className="seat-row" role="row" key={row}>
              <span className="row-label" aria-hidden="true">{row}</span>
              {Array.from({ length: cols }, (_, c) => {
                const seat = `${row}${c + 1}`;
                const isBooked = bookedSet.has(seat);
                const isSelected = selectedSet.has(seat);
                const disabled = isBooked || (!isSelected && atLimit);
                const state = isBooked ? 'booked' : isSelected ? 'selected' : 'available';
                return (
                  <button
                    key={seat}
                    type="button"
                    role="gridcell"
                    className={`seat seat-${state}${aisleAfter === c + 1 ? ' seat-aisle' : ''}`}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    aria-label={`Seat ${seat}, ${state}`}
                    title={seat}
                    onClick={() => onToggle(seat)}
                  >
                    {c + 1}
                  </button>
                );
              })}
              <span className="row-label" aria-hidden="true">{row}</span>
            </div>
          );
        })}
      </div>
      <ul className="legend">
        <li><span className="seat seat-available legend-swatch" /> Available</li>
        <li><span className="seat seat-selected legend-swatch" /> Selected</li>
        <li><span className="seat seat-booked legend-swatch" /> Booked</li>
      </ul>
    </div>
  );
}
