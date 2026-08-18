import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    short: z.string(), // 一覧カード用の一行説明
    law: z.string(), // 根拠法令
    en: z.string().optional(), // 英字キャプション（トップの一覧に小さく出す。旧HPの型）
    icon: z.enum(['building', 'house', 'certificate', 'slope', 'field', 'river', 'road']).optional(), // トップ一覧のアイコン
    order: z.number(),
    period: z.string(), // 所要期間の目安
    fee: z.string(), // 料金の考え方（金額は書かない）
    steps: z.array(z.object({ title: z.string(), note: z.string().optional() })).default([]), // 手続の流れ図
    diagram: z.enum(['drainage', 'zone', 'morido']).optional(), // 本文の後に出す図解
    image: z.string().optional(), // ページ上部のイメージ画像（/images/services/*.jpg。AI生成はキャプションに明記）
    imageAlt: z.string().optional(),
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
