import type { StudioDesign } from '@/lib/studio-design';

export type RelatedFlag = {
  name: string;
  image: string;
  id: string;
};

export type Flag = {
  id: string;
  flagName: string;
  flagImage: string;
  link: string;
  index: number;
  tags: string[];
  description: string;
  favorites?: number;
  isFavorite?: boolean;
  relatedFlags?: RelatedFlag[];
  sources: string[];
  /** Set for flags made in the flag maker. */
  remixOf?: string | null;
  design?: StudioDesign | null;
};

export type FlagRequestWithUser = {
  id: string;
  userId: string;
  oldFlag: Omit<Flag, 'id'> | null;
  approved: boolean;
  flag: Omit<Flag, 'id'>;
  flagId: string | null;
  isEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  userMessage: string;
  userName: string | null;
  userIsTrusted?: boolean | null;
};
