import { useEffect, useState } from 'react';
import { Drawer, Spin, Empty } from 'antd';
import apiClient from '../../api/client';
import PaperTemplatePreview from './PaperTemplatePreview';

interface PaperPreviewDrawerProps {
  open: boolean;
  paperId: string;
  onClose: () => void;
}

export default function PaperPreviewDrawer({ open, paperId, onClose }: PaperPreviewDrawerProps) {
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && paperId) {
      setLoading(true);
      Promise.all([
        apiClient.get('/exam-papers/' + paperId),
        apiClient.get('/exam-papers/' + paperId + '/questions'),
      ]).then((results) => {
        let p = results[0].data;
        if (p && p.data) p = p.data;
        setPaper(p);
        let qs = results[1].data;
        if (qs && qs.data) qs = qs.data;
        setQuestions(Array.isArray(qs) ? qs : (qs || []));
      }).catch((err) => {
        console.error('Preview load error:', err);
        setPaper(null);
        setQuestions([]);
      }).finally(() => { setLoading(false); });
    }
  }, [open, paperId]);

  let body;
  if (loading) {
    body = <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />;
  } else if (!paper) {
    body = <Empty description="加载失败" />;
  } else {
    body = (
      <PaperTemplatePreview
        title={paper.title}
        subtitle={paper.subtitle || (paper.subject + ' | 总分: ' + (paper.total_score || 0) + '分 | 时长: ' + (paper.duration_minutes || 0) + '分钟')}
        notes={paper.instructions || paper.description || ''}
        questions={questions}
        readonly
      />
    );
  }

  return <Drawer title="试卷预览" open={open} onClose={onClose} width={800}>{body}</Drawer>;
}
