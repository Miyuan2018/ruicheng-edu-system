import styles from './Chalkboard.module.css';

interface ChalkboardFrameProps {
  children: React.ReactNode;
}

function ChalkboardFrame({ children }: ChalkboardFrameProps) {
  return (
    <div className={styles.chalkboardFrame}>
      <div className={styles.chalkboardInner}>
        {children}
      </div>
    </div>
  );
}

export default ChalkboardFrame;
