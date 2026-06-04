import { createContext, useContext } from 'react';
import type { MealsController } from './hooks/useMealsController';

// Context exposing the Repas screen controller to the deep component tree (DayHeader,
// MealColumn, FoodLine, modals) without prop-drilling. MealsPage builds the controller and
// provides it; everything else reads it via useMeals().
const MealsContext = createContext<MealsController | null>(null);

export const MealsProvider = MealsContext.Provider;

export function useMeals(): MealsController {
  const ctx = useContext(MealsContext);
  if (!ctx) throw new Error('useMeals must be used within MealsProvider');
  return ctx;
}
