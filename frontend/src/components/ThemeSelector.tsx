import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => setTheme('light')}
        className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
          theme === 'light'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Light mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
          theme === 'dark'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Dark mode"
      >
        <Moon size={16} />
      </button>
      <button
        onClick={() => setTheme('auto')}
        className={`px-2 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
          theme === 'auto'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Auto (system preference)"
      >
        <Monitor size={16} />
      </button>
    </div>
  );
};
