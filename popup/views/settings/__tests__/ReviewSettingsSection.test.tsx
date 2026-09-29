/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { updateSettings } from '@/background/learning';
import { background } from '@/shared/background-service';
import { replaceLearningDocument } from '@/shared/learning-document';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewSettingsSection } from '../ReviewSettingsSection';

vi.mock('@/shared/background-service');

it('clamps stepper changes to the allowed range and flags out-of-range typed limits', async () => {
  await replaceLearningDocument(buildLearningDocument({ settings: { maxNewCardsPerDay: 99 } }));
  createServiceMock(background).handle('updateSettings', updateSettings);
  render(<ReviewSettingsSection />, { wrapper: createPopupTestWrapper().wrapper });
  const input = await screen.findByRole('spinbutton');
  const increase = screen.getByRole('button', { name: 'Increase' });
  fireEvent.click(increase);
  await waitFor(() => expect(input).toHaveAttribute('placeholder', '100'));
  expect(increase).toBeDisabled();

  fireEvent.change(input, { target: { value: '150' } });
  fireEvent.blur(input);
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a whole number between 0 and 100.');
  expect(input).toHaveValue(150);
  fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
  await waitFor(() => expect(background.updateSettings).toHaveBeenLastCalledWith({ maxNewCardsPerDay: 99 }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(background.updateSettings).not.toHaveBeenCalledWith({ maxNewCardsPerDay: 150 });
});
