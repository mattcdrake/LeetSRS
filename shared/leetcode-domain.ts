import { z } from 'zod';

export const leetcodeDomainSchema = z.enum(['leetcode.com', 'leetcode.cn']);
export type LeetcodeDomain = z.infer<typeof leetcodeDomainSchema>;
