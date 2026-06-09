import { useMutation } from '@tanstack/react-query';
import type { MealSuggestionsRequest } from '@macronome/shared';
import { aiApi } from '../../../api/ai';

// AI meal-suggestions request (B-123). On-demand mutation triggered from the "Proposition IA"
// dialog; the server returns proposals with server-certified day totals. Nothing is persisted by
// this call — the user applies a chosen proposal through the normal POST /meals/:id/entries flow.
export function useMealSuggestions() {
  return useMutation({
    mutationFn: (body: MealSuggestionsRequest) => aiApi.mealSuggestions(body),
  });
}
