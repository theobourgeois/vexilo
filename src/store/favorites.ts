"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesStore {
  favorites: string[]; // Array of flag names
  addFavorite: (flagName: string) => void;
  removeFavorite: (flagName: string) => void;
  toggleFavorite: (flagName: string) => void;
  isFavorite: (flagName: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (flagName: string) =>
        set((state) => ({
          favorites: [...state.favorites, flagName],
        })),
      removeFavorite: (flagName: string) =>
        set((state) => ({
          favorites: state.favorites.filter((name) => name !== flagName),
        })),
      toggleFavorite: (flagName: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(flagName)) {
          removeFavorite(flagName);
        } else {
          addFavorite(flagName);
        }
      },
      isFavorite: (flagName: string) => {
        const { favorites } = get();
        return favorites.includes(flagName);
      },
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "flag-favorites",
    }
  )
); 