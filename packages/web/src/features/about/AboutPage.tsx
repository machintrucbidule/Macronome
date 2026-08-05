import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { AboutInfo } from '@macronome/shared';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { formatBytes, formatDuration } from './format';
import { useAbout } from './useAbout';
import styles from './about.module.css';

// À propos screen (specifications/screens/about.md): the app version + a live server/runtime
// snapshot from GET /api/v1/about. Every figure is server-gathered; this only renders + formats
// (CLAUDE.md rule 2). Reached from the account menu, between Paramètres and Se déconnecter.
interface Row {
  label: string;
  value: string;
}
interface Group {
  title: string;
  rows: Row[];
}

function buildGroups(info: AboutInfo, t: TFunction, locale: string): Group[] {
  const sys = info.system;
  const usedPct = sys.mem_total_bytes
    ? Math.round((1 - sys.mem_free_bytes / sys.mem_total_bytes) * 100)
    : 0;
  return [
    {
      title: t('about.group.app'),
      rows: [
        { label: t('about.row.name'), value: info.app.name },
        { label: t('about.row.version'), value: info.app.version },
        { label: t('about.row.environment'), value: info.app.environment },
      ],
    },
    {
      title: t('about.group.runtime'),
      rows: [
        { label: t('about.row.node'), value: info.runtime.node_version },
        {
          label: t('about.row.startedAt'),
          value: new Date(info.runtime.started_at).toLocaleString(locale),
        },
        { label: t('about.row.procUptime'), value: formatDuration(info.runtime.uptime_s) },
        { label: t('about.row.pid'), value: String(info.runtime.pid) },
      ],
    },
    {
      title: t('about.group.system'),
      rows: [
        { label: t('about.row.platform'), value: `${sys.platform} ${sys.os_release}` },
        { label: t('about.row.arch'), value: sys.arch },
        { label: t('about.row.hostname'), value: sys.hostname },
        {
          label: t('about.row.cpu'),
          value: `${sys.cpu_model} (${sys.cpu_cores} ${t('about.cores')})`,
        },
        { label: t('about.row.loadAvg'), value: sys.load_avg.map((n) => n.toFixed(2)).join(' · ') },
        {
          label: t('about.row.memory'),
          value: `${formatBytes(sys.mem_total_bytes - sys.mem_free_bytes)} / ${formatBytes(sys.mem_total_bytes)} (${usedPct}%)`,
        },
        { label: t('about.row.sysUptime'), value: formatDuration(sys.uptime_s) },
      ],
    },
    {
      title: t('about.group.process'),
      rows: [
        { label: t('about.row.rss'), value: formatBytes(info.process_memory.rss_bytes) },
        {
          label: t('about.row.heap'),
          value: `${formatBytes(info.process_memory.heap_used_bytes)} / ${formatBytes(info.process_memory.heap_total_bytes)}`,
        },
      ],
    },
    {
      title: t('about.group.database'),
      rows: [
        { label: t('about.row.postgres'), value: info.database.server_version },
        { label: t('about.row.dbSize'), value: formatBytes(info.database.size_bytes) },
      ],
    },
  ];
}

function InfoCard({ title, rows }: Group) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{title}</span>
      </div>
      <div className={styles.cb}>
        {rows.map((r) => (
          <div className={styles.row} key={r.label}>
            <span className={styles.lab}>{r.label}</span>
            <span className={styles.val}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  const { t, i18n } = useTranslation();
  const about = useAbout();
  const info = about.data?.data;
  return (
    <>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('about.title')}</h1>
        <p className={styles.lead}>{t('about.lead')}</p>
        {about.isLoading ? (
          <SkeletonRows />
        ) : !info ? (
          <EmptyState>{t('about.error')}</EmptyState>
        ) : (
          buildGroups(info, t, i18n.language).map((g) => (
            <InfoCard key={g.title} title={g.title} rows={g.rows} />
          ))
        )}
      </div>
    </>
  );
}
