// client/src/components/ClipboardSection.tsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';
import { useTranslation } from 'react-i18next'; // 引入 useTranslation

interface ClipboardSectionProps {
  refreshKey: number;
}

const isImageDataUrl = (value: string) => value.startsWith('data:image/');

export default function ClipboardSection({ refreshKey }: ClipboardSectionProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation(); // 初始化 useTranslation

  useEffect(() => {
    fetchClipboard();
  }, [refreshKey]); // Depend on refreshKey

  const fetchClipboard = async () => {
    const token = localStorage.getItem('token');
    if (!token) return; // 如果没登录，不发请求

    try {
      const { data } = await api.get('/clipboard');
      setContent(data.content);
    } catch (error: any) {
      // 只有在不是 401/403 的情况下才报错，因为 401 会被拦截器处理跳转
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast.error(t('clipboard_section.error_fetch'));
      }
    }
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await api.post('/clipboard', { content });
      toast.success(t('clipboard_section.success_update'));
    } catch (error) {
      toast.error(t('clipboard_section.error_update'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (isImageDataUrl(content)) {
        const blob = await (await fetch(content)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(content);
      }
      toast.success(t('clipboard_section.success_copy'));
    } catch (err) {
      toast.error(t('clipboard_section.error_copy'));
    }
  };

  const readBlobAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsDataURL(blob);
    });

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith('image/')));
        if (imageItem) {
          const imageType = imageItem.types.find((type) => type.startsWith('image/')) || 'image/png';
          const blob = await imageItem.getType(imageType);
          const dataUrl = await readBlobAsDataUrl(blob);
          if (dataUrl) {
            setContent(dataUrl);
            return;
          }
        }
      }

      const text = await navigator.clipboard.readText();
      setContent(text);
    } catch (err) {
      toast.error(t('clipboard_section.error_paste'));
    }
  };

  const handleClearClipboard = () => {
    setContent('');
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const { items } = event.clipboardData;
    if (!items?.length) return;

    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) setContent(result);
    };
    reader.readAsDataURL(file);
  };

  const showImagePreview = isImageDataUrl(content);
  const textareaValue = showImagePreview ? '' : content;

  return (
    <div className="bg-white shadow sm:rounded-lg transition-colors duration-200 dark:bg-gray-800 dark:ring-1 dark:ring-white/10">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">{t('clipboard_section.title')}</h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>{t('clipboard_section.description')}</p>
        </div>
        <div className="mt-5">
          <textarea
            rows={4}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors duration-200 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500 dark:focus:ring-indigo-500"
            value={textareaValue}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder={t('clipboard_section.textarea_placeholder')}
          />
        </div>
        {showImagePreview && (
          <div className="mt-4 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('clipboard_section.image_preview_label')}</div>
            <img
              src={content}
              alt={t('clipboard_section.image_preview_alt')}
              className="mt-2 max-h-64 w-full rounded-md object-contain"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setContent('')}
                className="text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                {t('clipboard_section.clear_image_button')}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-x-6">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            {t('clipboard_section.paste_from_clipboard_button')}
          </button>
          <button
            type="button"
            onClick={handleClearClipboard}
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {t('clipboard_section.clear_clipboard_button')}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            {t('clipboard_section.copy_to_device_button')}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isLoading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? t('clipboard_section.saving_button') : t('clipboard_section.update_cloud_clipboard_button')}
          </button>
        </div>
      </div>
    </div>
  );
}
