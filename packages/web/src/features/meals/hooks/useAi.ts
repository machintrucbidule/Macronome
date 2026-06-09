import { useMutation } from '@tanstack/react-query';
import type { DishPhotoMacrosRequest } from '@macronome/shared';
import { aiApi } from '../../../api/ai';

// AI dish-photo estimate (B-118). On-demand mutation triggered from the analysis sub-dialog;
// the result pre-fills the custom-entry form. Nothing is persisted by this call.
export function useDishPhotoMacros() {
  return useMutation({
    mutationFn: (body: DishPhotoMacrosRequest) => aiApi.dishPhotoMacros(body),
  });
}
