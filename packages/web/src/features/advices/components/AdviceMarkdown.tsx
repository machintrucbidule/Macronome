import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../advices.module.css';

// Render the AI advice reply (free Markdown) SAFELY (B-202, spec/logic/ai-advice.md §5): react-markdown
// does NOT render raw HTML (no `rehype-raw`), so untrusted model output can never inject markup. GFM
// adds lists/tables/strikethrough. Prose styling is scoped to `.md` (semantic tokens only).
export function AdviceMarkdown({ children }: { children: string }) {
  return (
    <div className={styles.md}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
