import api from '../utils/api';

export interface Routine {
  routine_id: string;
  activity: string;
  time: string;
  type: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface RoutineAssessment {
  routine_id: string;
  activity: string;
  scheduled_time: string;
  type: string;
  health_impact: string;
  city: string;
  aqi: number;
  dominant_pollutant: string;
  risk_level: 'SAFE' | 'CAUTION' | 'AVOID';
  personalised_reason: string;
  best_time_window: string;
  preventive_tip: string;
  should_notify: boolean;
}

export interface TodayCheck {
  date: string;
  assessments: RoutineAssessment[];
}

export interface RescheduleResult {
  routine_id: string;
  original_time: string;
  suggested_time: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AddRoutinePayload {
  activity: string;
  time: string;
  type: string;
  date: string; // YYYY-MM-DD local date
}

/** Returns today's date in YYYY-MM-DD using the device's local timezone. */
export function getLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formats a YYYY-MM-DD string as a human-readable label. */
export function formatRoutineDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = getLocalDateString();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const routineService = {
  getRoutines: (): Promise<Routine[]> =>
    api.get('/api/routines'),

  addRoutine: (payload: AddRoutinePayload): Promise<Routine> =>
    api.post('/api/routines', payload),

  deleteRoutine: (routine_id: string): Promise<void> =>
    api.delete(`/api/routines/${routine_id}`),

  /** Pass the device's local date so the backend filters correctly regardless of timezone. */
  getTodayCheck: (): Promise<TodayCheck> =>
    api.get(`/api/routines/today-check?date=${getLocalDateString()}`),

  aiReschedule: (routine_id: string): Promise<RescheduleResult> =>
    api.post('/api/routines/ai-reschedule', { routine_id }),
};
