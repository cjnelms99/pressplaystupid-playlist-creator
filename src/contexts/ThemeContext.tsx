import React, { createContext, useContext, useEffect, useState } from 'react';

type DarkModeOption = 'off' | 'always' | 'while-playing';

interface ThemeContextType {
  darkModeOption: DarkModeOption;
  setDarkModeOption: (option: DarkModeOption) => void;
  isDarkMode: boolean;
  setIsVideoPlaying: (playing: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [darkModeOption, setDarkModeOption] = useState<DarkModeOption>('off');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem('dark-mode-preference');
    if (saved && ['off', 'always', 'while-playing'].includes(saved)) {
      setDarkModeOption(saved as DarkModeOption);
    }
  }, []);

  // Save preference when changed
  useEffect(() => {
    localStorage.setItem('dark-mode-preference', darkModeOption);
  }, [darkModeOption]);

  // Calculate if dark mode should be active
  useEffect(() => {
    let shouldBeDark = false;
    
    switch (darkModeOption) {
      case 'always':
        shouldBeDark = true;
        break;
      case 'while-playing':
        shouldBeDark = isVideoPlaying;
        break;
      case 'off':
      default:
        shouldBeDark = false;
        break;
    }

    setIsDarkMode(shouldBeDark);
    
    // Apply to document
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkModeOption, isVideoPlaying]);

  return (
    <ThemeContext.Provider
      value={{
        darkModeOption,
        setDarkModeOption,
        isDarkMode,
        setIsVideoPlaying,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};