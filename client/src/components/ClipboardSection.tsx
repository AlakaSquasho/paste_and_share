import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api';
import { useTranslation } from 'react-i18next';

interface ClipboardSectionProps {
  refreshKey: number;
  forceRefreshKey: number;
}

interface ClipboardImageRef {
  fileId: string;
  mimetype: string;
  size: number;
  originalName: string;
}

interface UploadFileMetadata {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
}

interface ClipboardTextPayload {
  version: 2;
  type: 'text';
  text: string;
}

interface ClipboardImagePayload {
  version: 2;
  type: 'image';
  image: ClipboardImageRef;
}

type ClipboardPayload = ClipboardTextPayload | ClipboardImagePayload;

type ClipboardDraft =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'image';
      previewUrl: string | null;
      imageRef: ClipboardImageRef | null;
    };

type ClipboardRemote =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'image';
      imageRef: ClipboardImageRef;
    };

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

const isClipboardImageRef = (value: unknown): value is ClipboardImageRef => {
  if (!isObject(value)) return false;
  return (
    typeof value.fileId === 'string' &&
    typeof value.mimetype === 'string' &&
    typeof value.size === 'number' &&
    typeof value.originalName === 'string'
  );
};

const toRemotePayload = (payload: ClipboardPayload): ClipboardRemote => {
  if (payload.type === 'image') {
    return {
      kind: 'image',
      imageRef: payload.image,
    };
  }

  return {
    kind: 'text',
    text: payload.text,
  };
};

const toDraftPayload = (draft: ClipboardDraft): ClipboardPayload | null => {
  if (draft.kind === 'image') {
    if (!draft.imageRef) return null;
    return {
      version: 2,
      type: 'image',
      image: draft.imageRef,
    };
  }

  return {
    version: 2,
    type: 'text',
    text: draft.text,
  };
};

const parseClipboardPayload = (rawPayload: unknown): ClipboardPayload | null => {
  if (!isObject(rawPayload) || rawPayload.version !== 2) return null;

  if (rawPayload.type === 'text' && typeof rawPayload.text === 'string') {
    return {
      version: 2,
      type: 'text',
      text: rawPayload.text,
    };
  }

  if (rawPayload.type === 'image' && isClipboardImageRef(rawPayload.image)) {
    return {
      version: 2,
      type: 'image',
      image: rawPayload.image,
    };
  }

  return null;
};

const fetchBlobByFileId = async (fileId: string) => {
  const response = await api.get(`/files/${fileId}`, { responseType: 'blob' });
  return response.data as Blob;
};

const createUploadFile = (file: Blob) => {
  if (file instanceof File) {
    return file;
  }

  return new File([file], `clipboard-${Date.now()}.png`, {
    type: file.type || 'image/png',
  });
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
  const { t } = useTranslation();

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

  const nextOpId = useCallback(() => {
    opCounterRef.current += 1;
    const opId = opCounterRef.current;
    setModel((prev) => ({ ...prev, currentOpId: opId }));
    return opId;
  }, []);

  const applyRemotePayload = useCallback(
    async (payload: ClipboardPayload, opId: number) => {
      const remote = toRemotePayload(payload);
      const currentModel = modelRef.current;

      if (currentModel.dirty) {
        setModel((prev) => ({
          ...prev,
          remote,
        }));
        return;
      }

      if (payload.type === 'text') {
        if (fetchOpIdRef.current !== opId) return;
        setModel((prev) => ({
          ...prev,
          draft: { kind: 'text', text: payload.text },
          remote,
          dirty: false,
          status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
        }));
        return;
      }

      try {
        const blob = await fetchBlobByFileId(payload.image.fileId);
        if (fetchOpIdRef.current !== opId) return;
        const previewUrl = URL.createObjectURL(blob);
        if (fetchOpIdRef.current !== opId) {
          URL.revokeObjectURL(previewUrl);
          return;
        }

        setModel((prev) => ({
          ...prev,
          draft: {
            kind: 'image',
            previewUrl,
            imageRef: payload.image,
          },
          remote,
          dirty: false,
          status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
        }));
      } catch {
        if (fetchOpIdRef.current !== opId) return;
        setModel((prev) => ({
          ...prev,
          draft: {
            kind: 'image',
            previewUrl: null,
            imageRef: payload.image,
          },
          remote,
          dirty: false,
          status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
        }));
        toast.error(t('clipboard_section.error_image_load'));
      }
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

        const payload = parseClipboardPayload(data?.payload);
        if (!payload) {
          toast.error(t('clipboard_section.error_unsupported_payload'));
          return;
        }

        if (forceApplyDraft) {
          const remote = toRemotePayload(payload);
          if (payload.type === 'text') {
            setModel((prev) => ({
              ...prev,
              draft: { kind: 'text', text: payload.text },
              remote,
              dirty: false,
              status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
            }));
            return;
          }

          try {
            const blob = await fetchBlobByFileId(payload.image.fileId);
            if (fetchOpIdRef.current !== opId) return;
            const previewUrl = URL.createObjectURL(blob);
            if (fetchOpIdRef.current !== opId) {
              URL.revokeObjectURL(previewUrl);
              return;
            }

            setModel((prev) => ({
              ...prev,
              draft: {
                kind: 'image',
                previewUrl,
                imageRef: payload.image,
              },
              remote,
              dirty: false,
              status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
            }));
          } catch {
            if (fetchOpIdRef.current !== opId) return;
            setModel((prev) => ({
              ...prev,
              draft: {
                kind: 'image',
                previewUrl: null,
                imageRef: payload.image,
              },
              remote,
              dirty: false,
              status: prev.status === 'saving' || prev.status === 'uploading' ? prev.status : 'idle',
            }));
            toast.error(t('clipboard_section.error_image_load'));
          }
          return;
        }

        await applyRemotePayload(payload, opId);
      } catch (error: any) {
        if (fetchOpIdRef.current !== opId) return;
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          toast.error(t('clipboard_section.error_fetch'));
        }
      }
    },
    [applyRemotePayload, nextOpId, t]
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
      const opId = nextOpId();
      uploadOpIdRef.current = opId;

      setModel((prev) => ({
        ...prev,
        draft: {
          kind: 'image',
          previewUrl,
          imageRef: null,
        },
        dirty: true,
        status: 'uploading',
      }));

      try {
        const uploadFile = createUploadFile(blob);
        const formData = new FormData();
        formData.append('file', uploadFile);
        const { data } = await api.post<UploadFileMetadata>('/files/upload', formData);

        if (uploadOpIdRef.current !== opId) return;

        setModel((prev) => {
          if (prev.draft.kind !== 'image') return prev;

          return {
            ...prev,
            draft: {
              kind: 'image',
              previewUrl: prev.draft.previewUrl,
              imageRef: {
                fileId: data.id,
                mimetype: data.mimetype,
                size: data.size,
                originalName: data.originalName,
              },
            },
            dirty: true,
            status: 'idle',
          };
        });
      } catch (error: any) {
        if (uploadOpIdRef.current !== opId) return;
        setModel((prev) => ({ ...prev, status: 'error' }));
        const errorMessage = error?.response?.data?.error || error?.message || t('clipboard_section.error_image_upload');
        toast.error(errorMessage);
      }
    },
    [nextOpId, t]
  );

  const handleUpdate = async () => {
    const payload = toDraftPayload(modelRef.current.draft);
    if (!payload) {
      toast.error(t('clipboard_section.error_image_upload'));
      return;
    }

    const opId = nextOpId();
    saveOpIdRef.current = opId;

    setModel((prev) => ({
      ...prev,
      status: 'saving',
    }));

    try {
      await api.post('/clipboard', payload);
      if (saveOpIdRef.current !== opId) return;

      setModel((prev) => {
        const remote = toRemotePayload(payload);
        const draft = prev.draft;

        if (draft.kind === 'image' && !draft.imageRef && payload.type === 'image') {
          draft.imageRef = payload.image;
        }

        return {
          ...prev,
          remote,
          dirty: false,
          status: 'idle',
        };
      });
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
        const { previewUrl, imageRef } = modelRef.current.draft;

        if (previewUrl) {
          const response = await fetch(previewUrl);
          blob = await response.blob();
        } else if (imageRef) {
          blob = await fetchBlobByFileId(imageRef.fileId);
        } else {
          toast.error(t('clipboard_section.error_copy'));
          return;
        }

        const mimeType = blob.type || imageRef?.mimetype || 'image/png';
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

  const handleClearClipboard = () => {
    setModel((prev) => ({
      ...prev,
      draft: { kind: 'text', text: '' },
      dirty: true,
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
                onClick={() =>
                  setModel((prev) => ({
                    ...prev,
                    draft: { kind: 'text', text: '' },
                    dirty: true,
                    status: 'idle',
                  }))
                }
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
