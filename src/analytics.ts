type Params = Record<string, string | number | boolean>;

type Metrika = {
  (counterId: number, method: 'reachGoal', goal: string, params?: Params): void;
};

const COUNTER_ID = 114661784;

export function track(event: string, params: Params = {}): void {
  const data = {
    ...params,
    game_version: '0.5.0',
  };

  if (import.meta.env?.DEV) {
    console.log('[Analytics]', event, data);
  }

  if (typeof window === 'undefined') return;

  const ym = (window as Window & { ym?: Metrika }).ym;

  if (typeof ym === 'function') {
    try {
      ym(COUNTER_ID, 'reachGoal', event, data);
    } catch (error) {
      console.warn('Analytics error', error);
    }
  }
}
