declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** URL of the FlashCards backend API. Set in .env as EXPO_PUBLIC_API_URL. */
      readonly EXPO_PUBLIC_API_URL: string;
    }
  }
}

export {};
