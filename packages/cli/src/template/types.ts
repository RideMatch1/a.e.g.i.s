import { z } from 'zod';

export const TemplateManifestSchema = z.object({
  name: z.string().min(1),
  stack: z.string().min(1),
  aegisVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'aegisVersion must be semver (x.y.z)'),
  description: z.string().min(1),
  placeholders: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)),
  postInstall: z.object({
    scan: z.boolean(),
    scanExpectedScore: z.number().int().min(0).max(1000),
    scanExpectedGrade: z.enum(['S', 'A', 'B', 'C', 'D', 'F']),
  }).strict(),
}).strict();

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;
