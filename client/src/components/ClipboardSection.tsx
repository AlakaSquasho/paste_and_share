// client/src/components/ClipboardSection.tsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function ClipboardSection() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchClipboard();
  }, []);

  const fetchClipboard = async () => {
    const token = localStorage.getItem('token');
    if (!token) return; // 如果没登录，不发请求

    try {
      const { data } = await api.get('/clipboard');
      setContent(data.content);
    } catch (error: any) {
      // 只有在不是 401/403 的情况下才报错，因为 401 会被拦截器处理跳转
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error('Failed to fetch clipboard');
      }
    }
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await api.post('/clipboard', { content });
      toast.success('Clipboard updated');
    } catch (error) {
      toast.error('Failed to update clipboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to local clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg transition-colors duration-200 dark:bg-gray-800 dark:ring-1 dark:ring-white/10">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Shared Clipboard</h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>Text shared here is accessible to all devices on the network.</p>
        </div>
        <div className="mt-5">
          <textarea
            rows={4}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors duration-200 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-indigo-500"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type or paste text here..."
          />
        </div>
        <div className="mt-3 flex items-center justify-end gap-x-6">
          <button
            type="button"
            onClick={handleCopy}
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            Copy to device
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isLoading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Saving...' : 'Update Cloud Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
