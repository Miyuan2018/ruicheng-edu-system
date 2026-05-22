import React, { useState } from 'react';
import { Tabs, Typography, Badge, Space } from 'antd';
import { EditOutlined, CameraOutlined, PrinterOutlined } from '@ant-design/icons';
import OnlineAnswerTab from '../exam-mistakes/OnlineAnswerTab';
import PhotoScanTab from '../exam-mistakes/PhotoScanTab';
import GenerateMistakeBookTab from '../exam-mistakes/GenerateMistakeBookTab';

var Title = Typography.Title;

export default function StudentPapersPage() {
  var activeTabState = useState('online'); var activeTab = activeTabState[0]; var setActiveTab = activeTabState[1];

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, '我的试卷'),
      React.createElement(Space, null,
        React.createElement('span', { style: { color: '#999', fontSize: 13 } }, '快捷操作：试卷答题、拍照扫描、生成练习本')
      )
    ),
    React.createElement(Tabs, { activeKey: activeTab, onChange: setActiveTab, size: 'large', items: [
      { key: 'online',
        label: React.createElement(Space, null, React.createElement(EditOutlined, null), '在线作答'),
        children: React.createElement(OnlineAnswerTab)
      },
      { key: 'scan',
        label: React.createElement(Space, null, React.createElement(CameraOutlined, null), '拍照扫描'),
        children: React.createElement(PhotoScanTab)
      },
      { key: 'generate',
        label: React.createElement(Space, null, React.createElement(PrinterOutlined, null), '生成纸质错题练习本'),
        children: React.createElement(GenerateMistakeBookTab)
      },
    ]})
  );
}
