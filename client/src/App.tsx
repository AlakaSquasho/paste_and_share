import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthGuard from './components/AuthGuard';
import LoginPage from './components/LoginPage';
import ClipboardSection from './components/ClipboardSection';
import FileSection from './components/FileSection';
import { useState, useCallback, useEffect } from 'react';
import { connectWebSocket, disconnectWebSocket, subscribeSyncEvent } from './ws';
import { useTheme, Theme } from './hooks/useTheme';
import { SunIcon, MoonIcon, ComputerDesktopIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next'; // 引入 useTranslation

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'clipboard' | 'files'>('clipboard');
  const { theme, setTheme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const { t, i18n } = useTranslation(); // 初始化 useTranslation
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  useEffect(() => {
    connectWebSocket();
    const unsubscribe = subscribeSyncEvent(() => {
      setRefreshKey((prevKey) => prevKey + 1);
    });

    return () => {
      unsubscribe();
      disconnectWebSocket();
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
  }, [currentLanguage]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  // 添加语言切换功能
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const themeIcons = {
    light: <SunIcon className="h-5 w-5" />,
    dark: <MoonIcon className="h-5 w-5" />,
    system: <ComputerDesktopIcon className="h-5 w-5" />,
  };

  const nextTheme: Record<Theme, Theme> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-sand text-ink transition-colors duration-200 dark:bg-night dark:text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-accent/25 blur-3xl dark:bg-accent/10" />
        <div className="absolute top-36 -left-20 h-64 w-64 rounded-full bg-ink/10 blur-3xl dark:bg-white/5" />
      </div>

      <div className="relative">
        <nav className="sticky top-4 z-30">
          <div className="mx-auto mb-6 max-w-6xl px-4 sm:mb-0 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white/90 px-4 py-3 shadow-soft backdrop-blur dark:border-white/10 dark:bg-night/70 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-shrink-0 items-center">
                  <h1 className="text-xl font-semibold text-ink dark:text-white">
                    <span className="text-accent">•</span> {t('app_name')}
                  </h1>
                </div>
                <div className="hidden sm:flex">
                  <div className="flex rounded-lg bg-ink/5 p-1 dark:bg-white/10">
                    <button
                      onClick={() => setActiveTab('clipboard')}
                      className={`${
                        activeTab === 'clipboard'
                          ? 'bg-accent text-ink'
                          : 'text-coal hover:text-ink dark:text-gray-300 dark:hover:text-white'
                      } w-24 rounded-md px-3 py-1.5 text-center text-sm font-semibold whitespace-nowrap transition-colors`}
                    >
                      {t('dashboard.clipboard_tab')}
                    </button>
                    <button
                      onClick={() => setActiveTab('files')}
                      className={`${
                        activeTab === 'files'
                          ? 'bg-accent text-ink'
                          : 'text-coal hover:text-ink dark:text-gray-300 dark:hover:text-white'
                      } w-24 rounded-md px-3 py-1.5 text-center text-sm font-semibold whitespace-nowrap transition-colors`}
                    >
                      {t('dashboard.files_tab')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <select
                  onChange={(e) => changeLanguage(e.target.value)}
                  value={currentLanguage}
                  className="cursor-pointer rounded-md border border-ink/10 bg-white/80 px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors focus:border-accent focus:ring-accent/30 dark:border-white/10 dark:bg-night/60 dark:text-white dark:[color-scheme:dark]"
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>

                <button
                  onClick={handleRefresh}
                  className="cursor-pointer rounded-md border border-ink/10 p-2 text-ink transition-colors hover:bg-ink/5 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
                  title={t('dashboard.refresh_button')}
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTheme(nextTheme[theme])}
                  className="cursor-pointer rounded-md border border-ink/10 p-2 text-ink transition-colors hover:bg-ink/5 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
                  title={`${t('dashboard.theme_mode.' + theme)} mode`}
                >
                  {themeIcons[theme]}
                </button>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer rounded-md border border-ink/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5 dark:border-white/10 dark:bg-night/60 dark:text-white dark:hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
                >
                  {t('dashboard.logout_button')}
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="sm:hidden">
          <div className="mx-auto mb-3 max-w-6xl px-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white/90 p-2 shadow-soft dark:border-white/10 dark:bg-night/70">
              <button
                onClick={() => setActiveTab('clipboard')}
                className={`${
                  activeTab === 'clipboard'
                    ? 'bg-accent text-ink'
                    : 'bg-ink/5 text-coal dark:bg-white/10 dark:text-gray-200'
                } rounded-md px-3 py-2 text-sm font-semibold transition-colors`}
              >
                {t('dashboard.clipboard_tab')}
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`${
                  activeTab === 'files'
                    ? 'bg-accent text-ink'
                    : 'bg-ink/5 text-coal dark:bg-white/10 dark:text-gray-200'
                } rounded-md px-3 py-2 text-sm font-semibold transition-colors`}
              >
                {t('dashboard.files_tab')}
              </button>
            </div>
          </div>
        </div>

        <div className="pb-10 pt-0 sm:py-10">
          <main>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              {activeTab === 'clipboard' ? <ClipboardSection refreshKey={refreshKey} /> : <FileSection refreshKey={refreshKey} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useTheme(); // Initialize theme logic at root level
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
