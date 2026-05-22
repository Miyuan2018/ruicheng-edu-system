import React, { useEffect, useState } from 'react';
import { Drawer, Spin, Empty } from 'antd';
import apiClient from '../../api/client';
import PaperTemplatePreview from './PaperTemplatePreview';

export default function PaperPreviewDrawer(props) {
  var open = props.open;
  var paperId = props.paperId;
  var onClose = props.onClose;

  var paperState = useState(null);
  var paper = paperState[0];
  var setPaper = paperState[1];
  var questionsState = useState([]);
  var questions = questionsState[0];
  var setQuestions = questionsState[1];
  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  useEffect(function () {
    if (open && paperId) {
      setLoading(true);
      Promise.all([
        apiClient.get('/exam-papers/' + paperId),
        apiClient.get('/exam-papers/' + paperId + '/questions'),
      ]).then(function (results) {
        var p = results[0].data;
        if (p && p.data) p = p.data;
        setPaper(p);
        var qs = results[1].data;
        if (qs && qs.data) qs = qs.data;
        setQuestions(Array.isArray(qs) ? qs : (qs || []));
      }).catch(function (err) {
        console.error('Preview load error:', err);
        setPaper(null);
        setQuestions([]);
      }).finally(function () { setLoading(false); });
    }
  }, [open, paperId]);

  var body;
  if (loading) {
    body = React.createElement(Spin, { style: { display: 'block', textAlign: 'center', padding: 40 } });
  } else if (!paper) {
    body = React.createElement(Empty, { description: '加载失败' });
  } else {
    body = React.createElement(PaperTemplatePreview, {
      title: paper.title,
      subtitle: paper.subtitle || (paper.subject + ' | 总分: ' + (paper.total_score || 0) + '分 | 时长: ' + (paper.duration_minutes || 0) + '分钟'),
      notes: paper.instructions || paper.description || '',
      questions: questions,
      readonly: true
    });
  }

  return React.createElement(Drawer, { title: '试卷预览', open: open, onClose: onClose, width: 800 }, body);
}
