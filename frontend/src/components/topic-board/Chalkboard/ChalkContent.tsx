import { useEffect, useRef } from 'react';
import katex from 'katex';
import styles from './Chalkboard.module.css';

interface ChalkContentProps {
  html: string;
}

function ChalkContent({ html }: ChalkContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll<HTMLElement>('.math');
    els.forEach((el) => {
      const latex = el.dataset.latex;
      if (!latex) return;
      katex.render(latex, el, {
        throwOnError: false,
        displayMode: el.classList.contains('display'),
        output: 'html',
      });
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={styles.chalkContent}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default ChalkContent;
