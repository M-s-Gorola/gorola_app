import { beforeEach,describe, expect, it, vi } from 'vitest';

import * as api from '../lib/api';
import { useWeatherStore } from './weather.store';

vi.mock('../lib/api', () => ({
  getFeatureFlag: vi.fn(),
}));

describe('useWeatherStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWeatherStore.setState({ isWeatherMode: false, isFetching: false });
  });

  it('should have initial state', () => {
    const state = useWeatherStore.getState();
    expect(state.isWeatherMode).toBe(false);
    expect(state.isFetching).toBe(false);
  });

  it('should fetch weather mode correctly', async () => {
    vi.mocked(api.getFeatureFlag).mockResolvedValueOnce(true);

    const promise = useWeatherStore.getState().fetchWeatherMode();
    
    expect(useWeatherStore.getState().isFetching).toBe(true);
    
    await promise;

    expect(useWeatherStore.getState().isWeatherMode).toBe(true);
    expect(useWeatherStore.getState().isFetching).toBe(false);
  });

  it('should handle fetch failure by defaulting to false', async () => {
    vi.mocked(api.getFeatureFlag).mockRejectedValueOnce(new Error('API error'));

    await useWeatherStore.getState().fetchWeatherMode();

    expect(useWeatherStore.getState().isWeatherMode).toBe(false);
    expect(useWeatherStore.getState().isFetching).toBe(false);
  });
});
