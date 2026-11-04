import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SeatMap from '../components/SeatMap';

describe('SeatMap', () => {
  it('renders rows × cols seats with correct states', () => {
    render(<SeatMap rows={3} cols={4} booked={['A1']} selected={['B2']} onToggle={() => {}} />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(12);
    expect(screen.getByLabelText('Seat A1, booked')).toBeDisabled();
    expect(screen.getByLabelText('Seat B2, selected')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Seat C4, available')).toBeEnabled();
  });

  it('calls onToggle with the seat code', async () => {
    const onToggle = vi.fn();
    render(<SeatMap rows={2} cols={2} onToggle={onToggle} />);
    await userEvent.click(screen.getByLabelText('Seat B1, available'));
    expect(onToggle).toHaveBeenCalledWith('B1');
  });

  it('disables unselected seats once the max is reached but keeps selected ones toggleable', () => {
    render(<SeatMap rows={1} cols={3} selected={['A1', 'A2']} max={2} onToggle={() => {}} />);
    expect(screen.getByLabelText('Seat A3, available')).toBeDisabled();
    expect(screen.getByLabelText('Seat A1, selected')).toBeEnabled();
  });
});
