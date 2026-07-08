import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import styles from '../users.module.css';

// One-shot link display (screens/users.md): a readonly selectable input + a copy
// button. navigator.clipboard is progressive enhancement only — a plain-HTTP LAN
// host has no clipboard API, so manual selection must always work.
export function TokenLinkField({ url }: { url: string }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    inputRef.current?.select();
    void navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className={styles.linkRow}>
      <input
        ref={inputRef}
        className={styles.linkField}
        value={url}
        readOnly
        onFocus={(e) => e.target.select()}
      />
      <Button variant="ghost" onClick={copy}>
        {t(copied ? 'users.links.copied' : 'users.links.copy')}
      </Button>
    </div>
  );
}
