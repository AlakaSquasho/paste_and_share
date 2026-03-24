import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api';
import { useTranslation } from 'react-i18next';

interface ClipboardSectionProps {
  refreshKey: number;
  forceRefreshKey: number;
}

interface ClipboardImageInfo {
  mimetype: string;
  size: number;
  originalName: string;
}

interface UploadImageResponse {
  id: string;
  mimetype: string;
  size: number;
  originalName: string;
}

interface ClipboardTextPayload {
  version: 2;
  type: 'text';
  text: string;
}

type ClipboardDraft =
  | { kind: 'text'; text: string }
  | { kind: 'image'; previewUrl: string | null; imageInfo: ClipboardImageInfo | null; pendingBlob: Blob | null };

type ClipboardRemote =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageInfo: ClipboardImageInfo };

type ClipboardStatus = 'idle' | 'uploading' | 'saving' | 'error';

interface ClipboardModel {
  draft: ClipboardDraft;
  remote: ClipboardRemote;
  dirty: boolean;
  status: ClipboardStatus;
  currentOpId: number;
}

const detectIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parseTextPayload = (rawPayload: unknown): ClipboardTextPayload | null => {
  if (!isObject(rawPayload) || rawPayload.version !== 2) return null;
  if (rawPayload.type === 'text' && typeof rawPayload.text === 'string') {
    return { version: 2, type: 'text', text: rawPayload.text as string };
  }
  return null;
};

const fetchClipboardImageBlob = async () => {
  const response = await api.get('/clipboard/image', { responseType: 'blob' });
  return response.data as Blob;
};

const createUploadFile = (file: Blob) => {
  if (file instanceof File) return file;
  return new File([file], `clipboard-${Date.now()}.png`, { type: file.type || 'image/png' });
};

export default function ClipboardSection({ refreshKey, forceRefreshKey }: ClipboardSectionProps) {
  const [model, setModel] = useState<ClipboardModel>({
    draft: { kind: 'text', text: '' },
    remote: { kind: 'text', text: '' },
    dirty: false,
    status: 'idle',
    currentOpId: 0,
  });
  const [textareaRenderKey, setTextareaRenderKey] = useState(0);

  const isIOSDevice = useRef(detectIOSDevice());
  const lastTextRef = useRef('');
  const lastPreviewUrlRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const opCounterRef = useRef(0);
  const uploadOpIdRef = useRef(0);
  const fetchOpIdRef = useRef(0);
  const saveOpIdRef = useRef(0);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const draftText = model.draft.kind === 'text' ? model.draft.text : '';
  const draftPreviewUrl = model.draft.kind === 'image' ? model.draft.previewUrl : null;

  useEffect(() => {
    const prev = lastPreviewUrlRef.current;
    if (prev && prev !== draftPreviewUrl) {
      URL.revokeObjectURL(prev);
    }
    lastPreviewUrlRef.current = draftPreviewUrl;
  }, [draftPreviewUrl]);

  useEffect(() => {
    return () => {
      if (lastPreviewUrlRef.current) {
        URL.revokeObjectURL(lastPreviewUrlRef.current);
        lastPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isIOSDevice.current) return;

    if (lastTextRef.current && !draftText) {
      setTextareaRenderKey((prev) => prev + 1);
    }
    lastTextRef.current = draftText;
  }, [draftText]);

  const { t } = useTranslation();

  const nextOpId = useCallback(() => {
    opCounterRef.current += 1;
    const opId = opCounterRef.current;
    setModel((prev) => ({ ...prev, currentOpId: opId }));
    return opId;
  }, []);

  const applyRemoteData = useCallback(
    async (
      payload: ClipboardTextPayload | null,
      hasImage: boolean,
      imageInfo: ClipboardImageInfo | null,
      opId: number,
    ) => {
      const currentModel = modelRef.current;

      if (currentModel.dirty) {
        setModel((prev) => ({
          ...prev,
          remote: hasImage && imageInfo ? { kind: 'image', imageInfo } : { kind: 'text', text: payload?.text ?? '' },
        }));
        return;
      }

      if (hasImage && imageInfo) {
        try {
          const blob = await fetchClipboardImageBlob();
          if (fetchOpIdRef.current !== opId) return;
          const previewUrl = URL.createObjectURL(blob);
          setModel((prev) => ({
            ...prev,
            draft: { kind: 'image', previewUrl, imageInfo, pendingBlob: null },
            remote: { kind: 'image', imageInfo },
            dirty: false,
            status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
          }));
        } catch {
          if (fetchOpIdRef.current !== opId) return;
          setModel((prev) => ({
            ...prev,
            draft: { kind: 'image', previewUrl: null, imageInfo, pendingBlob: null },
            remote: { kind: 'image', imageInfo },
            dirty: false,
            status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
          }));
          toast.error(t('clipboard_section.error_image_load'));
        }
        return;
      }

      const text = payload?.text ?? '';
      if (fetchOpIdRef.current !== opId) return;
      setModel((prev) => ({
        ...prev,
        draft: { kind: 'text', text },
        remote: { kind: 'text', text },
        dirty: false,
        status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
      }));
    },
    [t]
  );

  const fetchClipboard = useCallback(
    async (forceApplyDraft = false) => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const opId = nextOpId();
      fetchOpIdRef.current = opId;

      try {
        const { data } = await api.get('/clipboard');
        if (fetchOpIdRef.current !== opId) return;

        const { payload: rawPayload, hasImage, imageInfo } = data;

        if (!forceApplyDraft && modelRef.current.dirty) return;

        const payload = parseTextPayload(rawPayload);
        await applyRemoteData(payload, !!hasImage, imageInfo ?? null, opId);
      } catch (error: any) {
        if (fetchOpIdRef.current !== opId) return;
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          toast.error(t('clipboard_section.error_fetch'));
        }
      }
    },
    [applyRemoteData, nextOpId, t]
  );

  useEffect(() => {
    fetchClipboard(false);
  }, [fetchClipboard, refreshKey]);

  useEffect(() => {
    if (forceRefreshKey === 0) return;
    fetchClipboard(true);
  }, [fetchClipboard, forceRefreshKey]);

  const uploadClipboardImage = useCallback(
    async (blob: Blob, previewUrl: string) => {
      setModel((prev) => ({
        ...prev,
        draft: { kind: 'image', previewUrl, imageInfo: null, pendingBlob: blob },
        dirty: true,
        status: 'idle',
      }));
    },
    []
  );

  const handleUpdate = async () => {
    const draft = modelRef.current.draft;

    if (draft.kind === 'image') {
      if (!draft.pendingBlob && !draft.imageInfo) {
        toast.error(t('clipboard_section.error_image_upload'));
        return;
      }

      if (draft.pendingBlob) {
        const opId = nextOpId();
        uploadOpIdRef.current = opId;
        setModel((prev) => ({ ...prev, status: 'uploading' }));

        try {
          const uploadFile = createUploadFile(draft.pendingBlob);
          const formData = new FormData();
          formData.append('file', uploadFile);
          const { data } = await api.put<UploadImageResponse>('/clipboard/image', formData);

          if (uploadOpIdRef.current !== opId) return;

          const imageInfo: ClipboardImageInfo = {
            mimetype: data.mimetype,
            size: data.size,
            originalName: data.originalName,
          };

          setModel((prev) => {
            if (prev.draft.kind !== 'image') return prev;
            return {
              ...prev,
              draft: { kind: 'image', previewUrl: prev.draft.previewUrl, imageInfo, pendingBlob: null },
              remote: { kind: 'image', imageInfo },
              dirty: false,
              status: 'idle',
            };
          });
          toast.success(t('clipboard_section.success_update'));
        } catch (error: any) {
          if (uploadOpIdRef.current !== opId) return;
          setModel((prev) => ({ ...prev, status: 'error' }));
          const errorMessage = error?.response?.data?.error || error?.message || t('clipboard_section.error_image_upload');
          toast.error(errorMessage);
        }
      }
      return;
    }

    const payload: ClipboardTextPayload = { version: 2, type: 'text', text: draft.text };

    const opId = nextOpId();
    saveOpIdRef.current = opId;

    setModel((prev) => ({
      ...prev,
      status: 'saving',
    }));

    try {
      if (modelRef.current.remote.kind === 'image') {
        await api.delete('/clipboard/image');
      }
      await api.post('/clipboard', payload);
      if (saveOpIdRef.current !== opId) return;

      setModel((prev) => ({
        ...prev,
        remote: { kind: 'text', text: draft.text },
        dirty: false,
        status: 'idle',
      }));
      toast.success(t('clipboard_section.success_update'));
    } catch (error: any) {
      if (saveOpIdRef.current !== opId) return;
      setModel((prev) => ({ ...prev, status: 'error' }));
      const errorMessage = error?.response?.data?.error || error?.message || t('clipboard_section.error_update');
      toast.error(errorMessage);
    }
  };

  const handleCopy = async () => {
    try {
      if (modelRef.current.draft.kind === 'image') {
        let blob: Blob;
        const { previewUrl } = modelRef.current.draft;

        if (previewUrl) {
          const response = await fetch(previewUrl);
          blob = await response.blob();
        } else {
          blob = await fetchClipboardImageBlob();
        }

        const mimeType = blob.type || 'image/png';
        await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
      } else {
        await navigator.clipboard.writeText(modelRef.current.draft.text);
      }

      toast.success(t('clipboard_section.success_copy'));
    } catch {
      toast.error(t('clipboard_section.error_copy'));
    }
  };

  const handlePasteImage = useCallback(
    async (blob: Blob) => {
      const previewUrl = URL.createObjectURL(blob);
      await uploadClipboardImage(blob, previewUrl);
    },
    [uploadClipboardImage]
  );

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith('image/')));

        if (imageItem) {
          const imageType = imageItem.types.find((type) => type.startsWith('image/')) || 'image/png';
          const blob = await imageItem.getType(imageType);
          await handlePasteImage(blob);
          return;
        }
      }

      const text = await navigator.clipboard.readText();
      setModel((prev) => ({
        ...prev,
        draft: { kind: 'text', text },
        dirty: true,
        status: 'idle',
      }));
    } catch {
      toast.error(t('clipboard_section.error_paste'));
    }
  };

  const handleClearClipboard = async () => {
    setModel((prev) => ({
      ...prev,
      draft: { kind: 'text', text: '' },
      dirty: false,
      status: 'idle',
    }));
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const { items } = event.clipboardData;
    if (!items?.length) return;

    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    await handlePasteImage(file);
  };

  const isUploading = model.status === 'uploading';
  const isSaving = model.status === 'saving';
  const showImagePreview = model.draft.kind === 'image';

  return (
    <div className="rounded-xl border border-ink/10 bg-white/90 shadow-soft backdrop-blur transition-colors duration-200 dark:border-white/10 dark:bg-night/70">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-semibold leading-6 text-ink dark:text-white">{t('clipboard_section.title')}</h3>
        <div className="mt-2 max-w-xl text-sm text-coal dark:text-gray-300">
          <p>{t('clipboard_section.description')}</p>
        </div>
        {model.draft.kind === 'text' && (
          <div className="mt-5">
            <textarea
              key={textareaRenderKey}
              rows={4}
              className="block w-full rounded-md border-0 bg-white/80 px-3 py-2 text-sm text-ink shadow-sm ring-1 ring-inset ring-ink/10 placeholder:text-coal/70 focus:ring-2 focus:ring-inset focus:ring-accent/50 transition-colors duration-200 dark:bg-night/60 dark:text-white dark:ring-white/10 dark:placeholder:text-gray-500"
              value={draftText}
              onChange={(e) =>
                setModel((prev) => ({
                  ...prev,
                  draft: { kind: 'text', text: e.target.value },
                  dirty: true,
                  status: 'idle',
                }))
              }
              onPaste={handlePaste}
              placeholder={t('clipboard_section.textarea_placeholder')}
            />
          </div>
        )}
        {showImagePreview && (
          <div className="mt-4 rounded-lg border border-ink/10 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-coal dark:text-gray-300">{t('clipboard_section.image_preview_label')}</div>
            {draftPreviewUrl ? (
              <img src={draftPreviewUrl} alt={t('clipboard_section.image_preview_alt')} className="mt-2 max-h-64 w-full rounded-md object-contain" />
            ) : (
              <div className="mt-2 text-sm text-coal dark:text-gray-300">{t('clipboard_section.loading_image_preview')}</div>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleClearClipboard}
                className="cursor-pointer text-xs font-semibold text-coal hover:text-ink dark:text-gray-300 dark:hover:text-white"
              >
                {t('clipboard_section.clear_image_button')}
              </button>
            </div>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-3 sm:flex sm:items-center sm:justify-end sm:gap-4">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="w-full cursor-pointer rounded-md border border-ink/10 bg-white/80 px-3 py-2 text-center text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5 dark:border-white/10 dark:bg-night/60 dark:text-gray-200 dark:hover:bg-white/10 sm:w-auto sm:px-4"
          >
            {isUploading ? t('clipboard_section.uploading_image_button') : t('clipboard_section.paste_from_clipboard_button')}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full cursor-pointer rounded-md border border-ink/10 bg-white/80 px-3 py-2 text-center text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5 dark:border-white/10 dark:bg-night/60 dark:text-gray-200 dark:hover:bg-white/10 sm:w-auto sm:px-4"
          >
            {t('clipboard_section.copy_to_device_button')}
          </button>
          <button
            type="button"
            onClick={handleClearClipboard}
            className="w-full cursor-pointer rounded-md border border-ink/10 bg-white/80 px-3 py-2 text-center text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5 disabled:opacity-50 dark:border-white/10 dark:bg-night/60 dark:text-gray-200 dark:hover:bg-white/10 sm:w-auto sm:px-4"
          >
            {t('clipboard_section.clear_clipboard_button')}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isSaving || isUploading}
            className="w-full cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 sm:w-auto"
          >
            {isSaving ? t('clipboard_section.saving_button') : t('clipboard_section.update_cloud_clipboard_button')}
          </button>
        </div>
      </div>
    </div>
  );
}
