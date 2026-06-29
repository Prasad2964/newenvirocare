import api from '../utils/api';

export interface Routine {
  routine_id: string;
  activity: string;
  time: string;
  type: string;
  days: string[];
  health_impact: 'low' | 'medium' | 'high';
  location: string;
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
  days: string[];
  health_impact: 'low' | 'medium' | 'high';
  location: string;
}

export const routineService = {
  getRoutines: (): Promise<Routine[]> =>
    api.get('/api/routines'),

  addRoutine: (payload: AddRoutinePayload): Promise<Routine> =>
    api.post('/api/routines', payload),

  deleteRoutine: (routine_id: string): Promise<void> =>
    api.delete(`/api/routines/${routine_id}`),

  getTodayCheck: (): Promise<TodayCheck> =>
    api.get('/api/routines/today-check'),

  aiReschedule: (routine_id: string): Promise<RescheduleResult> =>
    api.post('/api/routines/ai-reschedule', { routine_id }),
};
