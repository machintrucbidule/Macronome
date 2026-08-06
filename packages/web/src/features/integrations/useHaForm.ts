import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { HomeAssistantPatch, HomeAssistantRead } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { notify } from '../../components/Toast/notify';
import { integrationsApi } from '../../api/integrations';
import { useSettingsMutation, useSettingsQuery } from '../settings/useSettings';

// State + handlers for the Home Assistant card (specifications/screens/integrations.md).
// Clone of useAiConnectionForm: seeds a draft from the redacted server config, saves a
// per-connection patch (token write-only: omitted unless touched; '' clears), and runs
// the weight read as the connection proof — persist then test (integrations spec §5).
const KNOWN_HA_ERRORS = new Set([
  'ha_not_configured',
  'ha_unauthorized',
  'ha_entity_not_found',
  'ha_no_measurement',
  'ha_unavailable',
  'ha_unreachable',
  'ha_bad_response',
]);

function buildPatch(
  baseUrl: string,
  entityId: string,
  decimals: number,
  token: string,
  tokenDirty: boolean,
): HomeAssistantPatch {
  const patch: HomeAssistantPatch = {
    base_url: baseUrl,
    weight_entity_id: entityId,
    weight_round_decimals: decimals,
  };
  if (tokenDirty) patch.token = token;
  return patch;
}

/** Field-level 422 details → which card fields to flag (zodDetails path keys). */
function invalidFields(err: unknown): { baseUrl: boolean; entityId: boolean } {
  const d = err instanceof ApiError ? (err.details ?? {}) : {};
  return {
    baseUrl: d['integrations.home_assistant.base_url'] === 'invalid_url',
    entityId: d['integrations.home_assistant.weight_entity_id'] === 'invalid_entity_id',
  };
}

const onDisconnected = (): void => notify('disconnected');

export function useHaForm() {
  const ha = useSettingsQuery().data?.data.integrations.home_assistant ?? null;
  const save = useSettingsMutation();
  const test = useMutation({ mutationFn: () => integrationsApi.fetchHaWeight() });

  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [tokenDirty, setTokenDirty] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [decimals, setDecimals] = useState(1);
  const [baseUrlInvalid, setBaseUrlInvalid] = useState(false);
  const [entityIdInvalid, setEntityIdInvalid] = useState(false);

  // (Re)seed the draft whenever the server config changes (initial load + after a save).
  const seedKey = JSON.stringify(ha);
  useEffect(() => {
    const parsed: HomeAssistantRead | null =
      seedKey === 'null' ? null : (JSON.parse(seedKey) as HomeAssistantRead);
    setBaseUrl(parsed?.base_url ?? '');
    setEntityId(parsed?.weight_entity_id ?? '');
    setDecimals(parsed?.weight_round_decimals ?? 1);
    setToken('');
    setTokenDirty(false);
    setBaseUrlInvalid(false);
    setEntityIdInvalid(false);
  }, [seedKey]);

  const setTokenValue = (value: string): void => {
    setToken(value);
    setTokenDirty(true);
  };

  const persist = async (): Promise<boolean> => {
    setBaseUrlInvalid(false);
    setEntityIdInvalid(false);
    try {
      const patch = buildPatch(baseUrl, entityId, decimals, token, tokenDirty);
      await save.mutateAsync({ integrations: { home_assistant: patch } });
      return true;
    } catch (err) {
      const bad = invalidFields(err);
      setBaseUrlInvalid(bad.baseUrl);
      setEntityIdInvalid(bad.entityId);
      return false;
    }
  };

  // B-261: an explicit save whose effect is invisible until the next import.
  const onSave = (): void => void persist().then((ok) => ok && notify('integrationSaved'));

  // "Tester" persists the typed config first, then proves the link against it.
  const runTest = (): void => {
    void (async () => {
      if (await persist()) test.mutate();
    })();
  };

  const onDisconnect = (): void => {
    test.reset();
    save.mutate({ integrations: { home_assistant: null } }, { onSuccess: onDisconnected });
  };

  const testError =
    test.error instanceof ApiError && KNOWN_HA_ERRORS.has(test.error.code) ? test.error.code : null;

  return {
    configured: ha !== null,
    baseUrl,
    setBaseUrl,
    token,
    setTokenValue,
    tokenSet: ha?.token_set ?? false,
    tokenDirty,
    entityId,
    setEntityId,
    decimals,
    setDecimals,
    baseUrlInvalid,
    entityIdInvalid,
    runTest,
    testPending: save.isPending || test.isPending,
    testResult: test.isSuccess ? test.data.data : null,
    testError,
    onSave,
    onDisconnect,
    savePending: save.isPending,
  };
}
