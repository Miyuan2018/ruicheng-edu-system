import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Result, Button, Card, Statistic, Progress, List, Spin, Typography, Space } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { paperApi } from '../../api/papers';

const { Text } = Typography;

interface UnitResult {
  name: string;
  score: number;
  max_score: number;
}

interface SubmissionResult {
  paper_title: string;
  total_score: number;
  max_score: number;
  percentage: number;
  units: UnitResult[];
}

export default function StudentCompletionPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    paperApi.getSubmissionStatus(paperId)
      .then((resp: any) => {
        setResult(resp.data || resp);
      })
      .catch(() => {
        // Fallback: show minimal result
        setResult({
          paper_title: '试卷',
          total_score: 0,
          max_score: 0,
          percentage: 0,
          units: [],
        });
      })
      .finally(() => setLoading(false));
  }, [paperId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="加载结果中..." />
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Text type="danger">加载结果失败</Text>
        <br />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/my-papers')}>
          返回我的试卷
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <Result
        status="success"
        title="答题完成！"
        subTitle={result.paper_title}
        icon={<CheckCircleFilled style={{ color: '#52c41a', fontSize: 64 }} />}
      />
      <Card style={{ marginBottom: 24 }}>
        <Statistic
          title="总分"
          value={result.total_score}
          suffix={`/ ${result.max_score}`}
          valueStyle={{ color: '#1677ff', fontSize: 32 }}
        />
        <div style={{ marginTop: 16 }}>
          <Progress
            percent={Math.round(result.percentage)}
            status={result.percentage >= 60 ? 'success' : 'exception'}
            size={200}
          />
        </div>
      </Card>
      {result.units && result.units.length > 0 && (
        <Card title="单元成绩" style={{ marginBottom: 24, textAlign: 'left' }}>
          <List
            dataSource={result.units}
            renderItem={(unit: UnitResult) => (
              <List.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Text>{unit.name}</Text>
                  <Space>
                    <Text strong>
                      {unit.score} / {unit.max_score}
                    </Text>
                    {unit.score === unit.max_score && unit.max_score > 0 && (
                      <Text style={{ color: '#52c41a' }}>满分!</Text>
                    )}
                  </Space>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
      <Space>
        <Button onClick={() => navigate('/my-papers')}>返回试卷列表</Button>
      </Space>
    </div>
  );
}
