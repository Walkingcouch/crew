# Crew Platform — Claude Instructions

## Tech Stack

- **Framework:** React Native (Expo)
- **Styling:** NativeWind (Tailwind v4)
- **Local database:** SQLite (offline-first)
- **Data fetching / caching:** TanStack Query

## Architecture

Feature-based directory structure: `src/features/[feature-name]`

Each feature folder owns its screens, components, hooks, and services. No cross-feature imports except through a shared `src/shared/` layer.

## Conventions

- Use `Pressable` instead of `TouchableOpacity` for all interactive elements.
- Use `expo-symbols` for all icons.
- All API calls must go through custom hooks (no direct Supabase or fetch calls inside components).
