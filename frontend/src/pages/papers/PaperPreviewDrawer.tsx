import { useEffect, useState } from 'react';
import { Drawer, Spin, Empty, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import PaperTemplatePreview from './PaperTemplatePreview';
import type { ExamPaperUnit } from '../../types/paper';

interface PaperPreviewDrawerProps {
  open: boolean;
  paperId: string;
  onClose: () => void;
}

export default function PaperPreviewDrawer({ open, paperId, onClose }: PaperPreviewDrawerProps) {
  const [paper, setPaper] = useState<any>(null);
  const [units, setUnits] = useState<ExamPaperUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!paperId) {
      setError('未选择试卷');
      return;
    }
    setLoading(true);
    setError('');
    // Use preview endpoint which returns units with questions
    apiClient.get('/exam-papers/' + paperId + '/preview')
      .then((resp) => {
        const data = resp.data;
        setPaper(data);
        setUnits(data.units || []);
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail
          || err?.response?.data?.message
          || '';
        if (err?.response?.status === 404) {
          setError('试卷不存在或已被删除');
        } else if (err?.response?.status === 403) {
          setError('没有权限查看该试卷');
        } else if (detail) {
          setError(detail);
        } else if (err?.code === 'ERR_NETWORK') {
          setError('网络连接失败，请检查后端服务');
        } else {
          setError('加载失败，请稍后重试');
        }
        setPaper(null);
        setUnits([]);
      })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    if (open && paperId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paperId]);

  let body;
  if (loading) {
    body = <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} tip="加载中..." />;
  } else if (!paper) {
    body = (
      <Empty description={error || '加载失败'}>
        <Button icon={<ReloadOutlined />} onClick={load}>重试</Button>
      </Empty>
    );
  } else {
    const grades = paper.grade_level?.grades?.join(', ') || '';
    const infoParts: string[] = [];
    if (paper.subject) infoParts.push(paper.subject);
    if (grades) infoParts.push(grades);
    infoParts.push('总分: ' + (paper.total_score ?? 0) + '分');
    if (paper.duration_minutes != null) infoParts.push('时长: ' + paper.duration_minutes + '分钟');
    const infoLine = infoParts.join(' | ');
    const subtitle = paper.subtitle ? paper.subtitle + ' | ' + infoLine : infoLine;

    body = (
      <PaperTemplatePreview
        title={paper.title}
        subtitle={subtitle}
        instructions={paper.instructions || paper.description || ''}
        units={units}
        show_units={paper.show_units ?? false}
        readonly
      />
    );
  }

  return <Drawer title={paper?.title || '试卷预览'} open={open} onClose={onClose} width={800}>{body}</Drawer>;
}
