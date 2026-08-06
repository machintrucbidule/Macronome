import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { BarclaudeGatewayPatch, BarclaudeGatewayRead } from '@macronome/shared';
import { ApiError } from '../../api/client';
import { notify } from '../../components/Toast/notify';
import { integrationsApi } from '../../api/integrations';
import { useSettingsMutation, useSettingsQuery } from '../settings/useSettings';

// State + handlers for the BarclaudeGateway card (specifications/screens/integrations.md).
// Same doctrine as useHaForm: draft seeded from the redacted config, write-only api_key,
// "Tester" = persist then ping (the connection proof, integrations spec §6).
const KNOWN_GATEWAY_ERRORS = new Set([
  'gateway_not_configured',
  'gateway_unauthorized',
  'gateway_unavailable',
  'gateway_unreachable',
  'gateway_bad_response',
]);

export function useGatewayForm() {
  const gw = useSettingsQuery().data?.data.integrations.barclaude_gateway ?? null;
  const save = useSettingsMutation();
  const test = useMutation({ mutationFn: () => integrationsApi.pingGateway() });

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [baseUrlInvalid, setBaseUrlInvalid] = useState(false);

  const seedKey = JSON.stringify(gw);
  useEffect(() => {
    const parsed: BarclaudeGatewayRead | null =
      seedKey === 'null' ? null : (JSON.parse(seedKey) as BarclaudeGatewayRead);
    setBaseUrl(parsed?.base_url ?? '');
    setApiKey('');
    setKeyDirty(false);
    setBaseUrlInvalid(false);
  }, [seedKey]);

  const setApiKeyValue = (value: string): void => {
    setApiKey(value);
    setKeyDirty(true);
  };

  const persist = async (): Promise<boolean> => {
    setBaseUrlInvalid(false);
    const patch: BarclaudeGatewayPatch = { base_url: baseUrl };
    if (keyDirty) patch.api_key = apiKey;
    try {
      await save.mutateAsync({ integrations: { barclaude_gateway: patch } });
      return true;
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.details?.['integrations.barclaude_gateway.base_url'] === 'invalid_url'
      ) {
        setBaseUrlInvalid(true);
      }
      return false;
    }
  };

  const onSave = (): void => {
    // B-261: an explicit save whose effect is invisible until the next proxied call.
    void persist().then((ok) => {
      if (ok) notify('integrationSaved');
    });
  };

  const runTest = (): void => {
    void (async () => {
      if (await persist()) test.mutate();
    })();
  };

  const onDisconnect = (): void => {
    test.reset();
    save.mutate(
      { integrations: { barclaude_gateway: null } },
      { onSuccess: () => notify('disconnected') },
    );
  };

  const testError =
    test.error instanceof ApiError && KNOWN_GATEWAY_ERRORS.has(test.error.code)
      ? test.error.code
      : null;

  return {
    configured: gw !== null,
    baseUrl,
    setBaseUrl,
    apiKey,
    setApiKeyValue,
    apiKeySet: gw?.api_key_set ?? false,
    keyDirty,
    baseUrlInvalid,
    runTest,
    testPending: save.isPending || test.isPending,
    testResult: test.isSuccess ? test.data.data : null,
    testError,
    onSave,
    onDisconnect,
    savePending: save.isPending,
  };
}
