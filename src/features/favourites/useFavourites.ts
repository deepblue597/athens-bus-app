import { useSyncExternalStore } from 'react'
import { getFavourites, subscribeFavourites, toggleFavourite } from '../../data/favourites'

export function useFavourites() {
  const favourites = useSyncExternalStore(subscribeFavourites, getFavourites)
  return {
    favourites,
    isFavourite: (code: string) => favourites.some((s) => s.code === code),
    toggleFavourite,
  }
}
