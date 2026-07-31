import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Target, TargetVersion } from '@macronome/shared';
import {
  draftToBody,
  draftToPatchBody,
  initialTargetDraft,
  today,
  type TargetDraft,
} from './draft';
import { shortDate } from './format';
import {
  useRecomputeCount,
  useTarget,
  useTargetHistory,
  useTargetMutations,
  useTargetPreview,
  useTargetVersionMutations,
} from './useTargets';

// Controller hook for the Cibles screen (TH-1). It owns the create/edit mode, the draft,
// and the confirm dialogs, and exposes flat values + named handlers so the page stays a
// thin renderer (modularity.md). All derived figures still come from the server via the
// hooks below — the controller only orchestrates the UI state.

const errCode = (e: unknown): string | null =>
  e && typeof e === 'object' && 'code' in e ? String(e.code) : null;

/** A fresh create-mode draft: the given target's values but effective today (back-datable). */
const createDraft = (target: Target | null): TargetDraft => ({
  ...initialTargetDraft(target),
  effectiveFrom: today(),
});

/** "Depuis – Jusqu'au" label for the version being edited (empty in create mode). */
function periodLabelOf(editing: TargetVersion | null, lang: string, currentLabel: string): string {
  if (!editing) return '';
  const until = editing.until ? shortDate(editing.until, lang) : currentLabel;
  return `${shortDate(editing.effective_from, lang)} – ${until}`;
}

export function useTargetsController() {
  const { t, i18n } = useTranslation();
  const target = useTarget();
  const history = useTargetHistory();
  const { save } = useTargetMutations();
  const { patch, remove, recompute } = useTargetVersionMutations();
  const [editing, setEditing] = useState<TargetVersion | null>(null);
  const [draft, setDraft] = useState<TargetDraft>(() => createDraft(null));
  const [suggesting, setSuggesting] = useState(false);
  const [confirmRecompute, setConfirmRecompute] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TargetVersion | null>(null);

  const isPast = editing !== null && editing.until !== null;
  const recomputeCountQuery = useRecomputeCount(isPast ? editing.id : null);

  // Seed create mode from the current target whenever it (re)loads while not editing —
  // also reseeds the form after returning from edit mode or saving.
  useEffect(() => {
    if (editing === null && target.data) setDraft(createDraft(target.data.target));
  }, [editing, target.data]);

  const preview = useTargetPreview(draft, isPast);
  const live =
    preview.data ??
    (target.data ? { engine: target.data.engine, warnings: target.data.warnings } : null);

  function onSave(): void {
    if (editing) {
      patch.mutate(
        { id: editing.id, body: draftToPatchBody(draft) },
        { onSuccess: () => setEditing(null) },
      );
    } else {
      save.mutate(draftToBody(draft));
    }
  }

  function doDelete(): void {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, {
      onSuccess: () => {
        if (editing?.id === confirmDelete.id) setEditing(null);
        setConfirmDelete(null);
      },
    });
  }

  const periodLabel = periodLabelOf(editing, i18n.language, t('targets.history.current'));

  return {
    draft,
    editing,
    live,
    ready: Boolean(target.data && history.data),
    versions: history.data?.versions ?? [],
    recomputeCount: recomputeCountQuery.data?.count ?? null,
    mutError: errCode(patch.error) ?? errCode(save.error),
    saving: save.isPending || patch.isPending,
    recomputePending: recompute.isPending,
    removePending: remove.isPending,
    periodLabel,
    suggesting,
    confirmRecompute,
    confirmDelete,
    setSuggesting,
    setConfirmRecompute,
    setConfirmDelete,
    set: (p: Partial<TargetDraft>) => setDraft((d) => ({ ...d, ...p })),
    onSave,
    onSelect: (v: TargetVersion) => {
      setEditing(v);
      setDraft(initialTargetDraft(v));
    },
    onNewTarget: () => setDraft(createDraft(target.data?.target ?? null)),
    onBackToCurrent: () => setEditing(null),
    onDelete: () => editing && setConfirmDelete(editing),
    onRecompute: () => setConfirmRecompute(true),
    doRecompute: () =>
      editing &&
      recompute.mutate({ id: editing.id }, { onSuccess: () => setConfirmRecompute(false) }),
    doDelete,
    onApplySuggest: (min: number, max: number) => {
      setDraft((d) => ({ ...d, calorieMin: String(min), calorieMax: String(max) }));
      setSuggesting(false);
    },
  };
}

export type CiblesController = ReturnType<typeof useTargetsController>;
