import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { dataApi } from '../../api/data';

// Data-management mutations + the DataCard action controller (IMP-1). Wipe and import are
// account-wide and destructive; on success we reload so every cached query — and the restored
// theme/locale — refreshes.

export function useWipeMutation() {
  return useMutation({ mutationFn: () => dataApi.wipe() });
}

export function useImportMutation() {
  return useMutation({ mutationFn: (envelope: unknown) => dataApi.import(envelope) });
}

export type DataMode = null | 'wipe' | 'import';

export interface DataActions {
  fileRef: RefObject<HTMLInputElement>;
  mode: DataMode;
  setMode: (m: DataMode) => void;
  exporting: boolean;
  error: string | null;
  wipePending: boolean;
  importPending: boolean;
  onExport: () => void;
  onPickFile: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  confirmImport: () => void;
  confirmWipe: () => void;
}

export function useDataActions(): DataActions {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<DataMode>(null);
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wipe = useWipeMutation();
  const importData = useImportMutation();

  const onExport = (): void => {
    setError(null);
    setExporting(true);
    dataApi
      .exportFile()
      .catch(() => setError(t('settings.data.exportError')))
      .finally(() => setExporting(false));
  };

  const onPickFile = (): void => {
    setError(null);
    fileRef.current?.click();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    file
      .text()
      .then((text) => {
        setEnvelope(JSON.parse(text));
        setMode('import');
      })
      .catch(() => setError(t('settings.data.parseError')));
  };

  const reload = (): void => window.location.reload();

  const confirmImport = (): void => {
    importData.mutate(envelope, {
      onSuccess: reload,
      onError: () => {
        setMode(null);
        setError(t('settings.data.importError'));
      },
    });
  };

  const confirmWipe = (): void => {
    wipe.mutate(undefined, {
      onSuccess: reload,
      onError: () => {
        setMode(null);
        setError(t('settings.data.wipeError'));
      },
    });
  };

  return {
    fileRef,
    mode,
    setMode,
    exporting,
    error,
    wipePending: wipe.isPending,
    importPending: importData.isPending,
    onExport,
    onPickFile,
    onFileChange,
    confirmImport,
    confirmWipe,
  };
}
