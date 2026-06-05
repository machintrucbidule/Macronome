import { z } from 'zod';

// Container (tare) DTOs (spec/api §Settings, spec/schema/tables-catalog.md → container).
// The Contenants screen CRUD. The locked built-in "Rien" (0 g) cannot be edited or
// deleted (is_builtin); deleting any other container is free — leftover history froze its
// container_name + tare_g as a value (DECISIONS Gap 13). SI units (g).

const containerFields = {
  name: z.string().min(1).max(200),
  empty_weight_g: z.number().min(0),
};

export const CreateContainerSchema = z.object(containerFields);
export type CreateContainerRequest = z.infer<typeof CreateContainerSchema>;

export const UpdateContainerSchema = z
  .object({
    name: containerFields.name.optional(),
    empty_weight_g: containerFields.empty_weight_g.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type UpdateContainerRequest = z.infer<typeof UpdateContainerSchema>;

/** A stored container as returned by the API. */
export interface Container {
  id: string;
  name: string;
  empty_weight_g: number;
  is_builtin: boolean;
}
