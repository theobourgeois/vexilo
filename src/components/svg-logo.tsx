import mark from './logo-mark.svg';

/**
 * The Vexilo mark. The artwork lives in its own file, which browsers fetch once and keep, rather
 * than in the markup of every page. The ink follows the theme through the text colour.
 */
export function SvgLogo({ className }: { className?: string }) {
  return (
    <svg className={className} width='100%' viewBox='0 0 1024 1024' style={{ color: 'var(--logo-ink)' }}>
      <use href={`${mark.src}#mark`} />
    </svg>
  );
}
