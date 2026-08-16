import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    short: z.string(), // 一覧カード用の一行説明
    law: z.string(), // 根拠法令
    order: z.number(),
    period: z.string(), // 所要期間の目安
    fee: z.string(), // 料金の目安（レンジ）
    summary: z.string(), // meta description
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
});

export const collections = { services, news };
