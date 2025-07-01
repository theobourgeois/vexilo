"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Flag } from "@/lib/types";

interface FavoritesStore {
  favorites: Flag[]; // Array of flag objects
  addFavorite: (flag: Flag) => void;
  removeFavorite: (flagName: string) => void;
  toggleFavorite: (flag: Flag) => void;
  isFavorite: (flagName: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (flag: Flag) =>
        set((state) => ({
          favorites: [...state.favorites, flag],
        })),
      removeFavorite: (flagName: string) =>
        set((state) => ({
          favorites: state.favorites.filter((flag) => flag.flagName !== flagName),
        })),
      toggleFavorite: (flag: Flag) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(flag.flagName)) {
          removeFavorite(flag.flagName);
        } else {
          addFavorite(flag);
        }
      },
      isFavorite: (flagName: string) => {
        const { favorites } = get();
        return favorites.some((flag) => flag.flagName === flagName);
      },
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "flag-favorites",
      onRehydrateStorage: () => (state) => {
        // Migration: Check if old string-based favorites exist and clear them
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('flag-favorites');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // If the stored data has a state with favorites as strings, clear it
              if (parsed.state && Array.isArray(parsed.state.favorites) &&
                parsed.state.favorites.length > 0 &&
                typeof parsed.state.favorites[0] === 'string') {
                console.log('Migrating favorites from string format to object format');
                localStorage.removeItem('flag-favorites');
                if (state) {
                  state.favorites = [];
                }
              }
            } catch (error) {
              console.error('Error parsing stored favorites:', error);
              localStorage.removeItem('flag-favorites');
            }
          }
        }
      },
    }
  )
); 