import { defineCollection, z } from 'astro:content';

// Shapes match the Markdown + JSON written by Task 1's extractor.
// See content/EXTRACTION_REPORT.md in the repo root for the source-of-truth schema.

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Burgo'),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    featured_image: z.string().nullable().optional(),
    comment_count: z.number().default(0),
    permalink: z.string(),
    // Optional dek shown in homepage rows. If missing, layouts derive
    // a short excerpt from the first paragraph at build time.
    dek: z.string().optional(),
    sleeveTone: z
      .enum(['rust', 'cream', 'ink', 'mustard', 'olive'])
      .optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    permalink: z.string(),
    updated: z.coerce.date().optional(),
  }),
});

// Taxonomies and comments are data-only — defined here so Task 3 can drop
// JSON into src/content/{taxonomies,comments}/ without schema churn.
const taxonomies = defineCollection({
  type: 'data',
  schema: z.object({
    kind: z.enum(['tag', 'category']),
    entries: z.array(
      z.object({
        slug: z.string(),
        name: z.string(),
        post_count: z.number().default(0),
      }),
    ),
  }),
});

const comments = defineCollection({
  type: 'data',
  schema: z.array(
    z.object({
      author: z.string(),
      date: z.string(),
      body: z.string(),
      reply_to: z.string().nullable().optional(),
    }),
  ),
});

export const collections = { posts, pages, taxonomies, comments };
