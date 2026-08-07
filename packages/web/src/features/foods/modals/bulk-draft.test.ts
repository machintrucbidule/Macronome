import { describe, expect, it } from 'vitest';
import { draftChanges, draftToPatch, emptyBulkDraft, isEmptyDraft } from './bulk-draft';

// BE-1/D15: every control of the batch popup opens on « Ne pas modifier », and that state means
// the field is **absent from the request** — not sent as null, not sent as some current value.
// This is the rule the whole feature rests on: get it wrong and a batch silently overwrites four
// fields the user never touched.

describe('the batch patch carries only what was set (BE-1)', () => {
  it('sends nothing at all from an untouched form', () => {
    expect(draftToPatch(emptyBulkDraft)).toEqual({});
    expect(isEmptyDraft(emptyBulkDraft)).toBe(true);
  });

  it('sends one field and leaves the other four out entirely', () => {
    const patch = draftToPatch({ ...emptyBulkDraft, visibility: 'private' });
    expect(patch).toEqual({ visibility: 'private' });
    expect('rating' in patch).toBe(false);
    expect('comment' in patch).toBe(false);
    expect('source' in patch).toBe(false);
    expect('ai_proposable' in patch).toBe(false);
  });

  it('distinguishes « Pas noté » from « Ne pas modifier »', () => {
    // Unrated is a value: it must reach the wire as an explicit null.
    expect(draftToPatch({ ...emptyBulkDraft, rating: 'unrated' })).toEqual({ rating: null });
    expect(draftToPatch({ ...emptyBulkDraft, rating: '2' })).toEqual({ rating: 2 });
    expect(draftToPatch({ ...emptyBulkDraft, rating: 'keep' })).toEqual({});
  });

  it('« Effacer le commentaire » sends null, « Remplacer par… » sends the text', () => {
    expect(draftToPatch({ ...emptyBulkDraft, comment: 'clear', commentText: 'ignoré' })).toEqual({
      comment: null,
    });
    expect(draftToPatch({ ...emptyBulkDraft, comment: 'set', commentText: 'à revoir' })).toEqual({
      comment: 'à revoir',
    });
  });

  it('turns the yes/no control into the boolean the API expects', () => {
    expect(draftToPatch({ ...emptyBulkDraft, aiProposable: 'no' })).toEqual({
      ai_proposable: false,
    });
    expect(draftToPatch({ ...emptyBulkDraft, aiProposable: 'yes' })).toEqual({
      ai_proposable: true,
    });
  });

  it('recaps exactly the fields that will be written, in form order', () => {
    const changes = draftChanges(
      { ...emptyBulkDraft, rating: '3', visibility: 'shared', comment: 'clear' },
      (k) => k,
    );
    expect(changes.map((c) => c.label)).toEqual([
      'foods.field.rating',
      'foods.field.visibility',
      'foods.field.comment',
    ]);
    expect(draftChanges(emptyBulkDraft, (k) => k)).toEqual([]);
  });
});
