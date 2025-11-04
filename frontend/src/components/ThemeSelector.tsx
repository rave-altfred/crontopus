import { useTheme } from '../contexts/ThemeContext';

export const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => setTheme('light')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          theme === 'light'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Light mode"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          theme === 'dark'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Dark mode"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('auto')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          theme === 'auto'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        title="Auto (system preference)"
      >
        💻
      </button>
    </div>
  );
};
