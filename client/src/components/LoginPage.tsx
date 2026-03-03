// client/src/components/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next'; // 引入 useTranslation

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation(); // 初始化 useTranslation

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await axios.post('/api/auth/login', { password });
      localStorage.setItem('token', data.token);
      toast.success('Login successful!'); // 这里可以考虑翻译 "Login successful!"
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('login_page.error_invalid_password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-sand px-6 py-12 transition-colors duration-200 dark:bg-night lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-accent/25 blur-3xl dark:bg-accent/10" />
        <div className="absolute bottom-12 -left-16 h-64 w-64 rounded-full bg-ink/10 blur-3xl dark:bg-white/5" />
      </div>

      <div className="relative sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="rounded-xl border border-ink/10 bg-white/90 px-6 py-8 shadow-soft backdrop-blur dark:border-white/10 dark:bg-night/70">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-coal/70 dark:text-gray-400">
              {t('app_name')}
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-8 text-ink dark:text-white">
              {t('login_page.title')}
            </h2>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="password" university-data-label="password" className="block text-sm font-medium text-coal dark:text-gray-300">
                {t('login_page.password_placeholder')}
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 bg-white/80 px-3 py-2 text-ink shadow-sm ring-1 ring-inset ring-ink/10 placeholder:text-coal/60 focus:ring-2 focus:ring-inset focus:ring-accent/50 transition-colors duration-200 dark:bg-night/60 dark:text-white dark:ring-white/10 dark:placeholder:text-gray-500"
                  placeholder={t('login_page.password_placeholder')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full cursor-pointer justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              >
                {isLoading ? t('login_page.logging_in_button') : t('login_page.login_button')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
