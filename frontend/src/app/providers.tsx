"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { LocaleContext, getLocale, setLocale, type Locale } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleContext.Provider value={locale}>
        <LocaleChangeContext.Provider value={handleLocaleChange}>
          {children}
        </LocaleChangeContext.Provider>
      </LocaleContext.Provider>
    </QueryClientProvider>
  );
}

import { createContext, useContext } from "react";

const LocaleChangeContext = createContext<(locale: Locale) => void>(() => {});
export function useLocaleChange() {
  return useContext(LocaleChangeContext);
}
