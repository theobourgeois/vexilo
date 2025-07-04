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
};