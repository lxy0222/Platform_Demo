import React, { useState, useEffect } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Input,
  Form,
  message,
  Tooltip,
  Progress,
  Typography,
  Row,
  Col,
  Divider,
  Empty,
  Badge,
  Statistic,
  List,
  Avatar,
  Descriptions,
  Spin,
  Alert,
  Tabs,
  Collapse
} from 'antd';
import {
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ScanOutlined,
  FileImageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
  RobotOutlined,
  BulbOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  StarOutlined,
  SettingOutlined,
  DownOutlined,
  RightOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import './PageAnalysis.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface PageAnalysisRecord {
  id: string;
  page_name: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence_score?: number;
  page_title?: string;
  page_type?: string;
  ui_elements_count?: number;
  processing_time?: number;
  error_message?: string;
  file_size: number;
  created_at: string;
  // 图片相关字段
  image_path?: string;
  image_filename?: string;
}

interface AnalysisResult {
  page_title?: string;
  page_type?: string;
  main_content?: string;
  ui_elements?: UIElement[];
  confidence_score?: number;
  analysis_summary?: string;
  processing_time?: number;
  raw_analysis_json?: any;
  parsed_ui_elements?: any[];
}

interface UIElement {
  id: string;
  name: string;
  element_type: string;
  description: string;
  text_content?: string;
  position?: {
    area: string;
    relative_to?: string;
  };
  visual_features?: {
    color: string;
    size: string;
    shape: string;
  };
  functionality?: string;
  interaction_state?: string;
  confidence_score: number;
}

interface KnowledgeBaseSummary {
  total_pages: number;
  page_types: Array<{
    type: string;
    count: number;
  }>;
}

const PageAnalysis: React.FC = () => {
  // 添加图片预览样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .image-preview-modal .ant-modal-content {
        background: rgba(0, 0, 0, 0.9);
        border-radius: 12px;
      }
      .image-preview-modal .ant-modal-close {
        color: white;
        font-size: 20px;
      }
      .image-preview-modal .ant-modal-close:hover {
        color: #1890ff;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysisRecords, setAnalysisRecords] = useState<PageAnalysisRecord[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [pageNames, setPageNames] = useState<string>('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PageAnalysisRecord | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [knowledgeBaseSummary, setKnowledgeBaseSummary] = useState<KnowledgeBaseSummary | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [analysisProgress, setAnalysisProgress] = useState<{ [key: string]: number }>({});
  const [currentAnalysis, setCurrentAnalysis] = useState<{
    visible: boolean;
    sessionId: string;
    progress: number;
    status: string;
    currentStep: string;
  }>({
    visible: false,
    sessionId: '',
    progress: 0,
    status: '',
    currentStep: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 图片预览相关状态
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');

  // 处理图片点击放大
  const handleImageClick = (imagePath: string) => {
    const imageUrl = `/api/v1/web/page-analysis/image/${imagePath}`;
    setPreviewImageUrl(imageUrl);
    setImagePreviewVisible(true);
  };

  // 关闭图片预览
  const handleImagePreviewClose = () => {
    setImagePreviewVisible(false);
    setPreviewImageUrl('');
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (imagePreviewVisible && event.key === 'Escape') {
        handleImagePreviewClose();
      }
    };

    if (imagePreviewVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [imagePreviewVisible]);

  // 加载分析记录列表
  const loadAnalysisRecords = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/web/page-analysis/pages?page=${page}&page_size=${pageSize}`);
      if (response.ok) {
        const data = await response.json();
        // 将后端数据格式转换为前端期望的格式
        const mappedRecords = (data.data || []).map((record: any) => ({
          id: record.id,
          page_name: record.page_name,
          original_filename: record.original_filename || '未知文件',
          status: record.analysis_status || 'completed', // 映射 analysis_status 到 status
          confidence_score: record.confidence_score,
          page_title: record.page_name,
          page_type: record.page_type,
          ui_elements_count: record.elements_count || 0,
          processing_time: record.processing_time,
          error_message: record.error_message,
          file_size: record.file_size || 0,
          created_at: record.created_at,
          // 添加图片相关字段
          image_path: record.image_path,
          image_filename: record.image_filename
        }));
        setAnalysisRecords(mappedRecords);
        setPagination({
          current: data.page,
          pageSize: data.page_size,
          total: data.total
        });
      } else {
        message.error('加载分析记录失败');
      }
    } catch (error) {
      console.error('加载分析记录失败:', error);
      message.error('加载分析记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载知识库统计信息
  const loadKnowledgeBaseSummary = async () => {
    try {
      const response = await fetch('/api/v1/web/page-analysis/knowledge-base/summary');
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBaseSummary(data);
      }
    } catch (error) {
      console.error('加载知识库统计失败:', error);
    }
  };

  // 搜索知识库
  const searchKnowledgeBase = async (query: string, pageType?: string) => {
    try {
      const params = new URLSearchParams({ query });
      if (pageType) params.append('page_type', pageType);

      const response = await fetch(`/api/v1/web/page-analysis/knowledge-base/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        return data.results;
      }
    } catch (error) {
      console.error('搜索知识库失败:', error);
    }
    return [];
  };

  // 根据关键词搜索
  const searchByKeywords = async (keywords: string[]) => {
    try {
      const response = await fetch('/api/v1/web/page-analysis/knowledge-base/search-by-keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.results;
      }
    } catch (error) {
      console.error('关键词搜索失败:', error);
    }
    return [];
  };

  // 获取UI元素类型示例
  const getUIElementsByType = async (elementType: string) => {
    try {
      const response = await fetch(`/api/v1/web/page-analysis/knowledge-base/ui-elements/${elementType}`);
      if (response.ok) {
        const data = await response.json();
        return data.elements;
      }
    } catch (error) {
      console.error('获取UI元素失败:', error);
    }
    return [];
  };

  // 执行知识库搜索
  const handleKnowledgeBaseSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchKnowledgeBase(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        message.info('未找到相关页面');
      }
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 组件初始化
  useEffect(() => {
    loadAnalysisRecords();
    loadKnowledgeBaseSummary();
  }, []);

  // 删除分析记录
  const deleteAnalysisRecord = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/web/page-analysis/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        message.success('删除成功');
        loadAnalysisRecords();
        loadKnowledgeBaseSummary(); // 更新统计信息
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 清理卡住的任务
  const cleanupStuckTasks = async () => {
    try {
      const response = await fetch('/api/v1/web/page-analysis/cleanup-stuck', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        message.success(`已清理 ${data.cleaned_count} 个卡住的任务`);
        loadAnalysisRecords();
      } else {
        message.error('清理失败');
      }
    } catch (error) {
      console.error('清理失败:', error);
      message.error('清理失败');
    }
  };

  // 上传文件配置
  const uploadProps: UploadProps = {
    name: 'files',
    multiple: true,
    accept: 'image/*',
    fileList,
    beforeUpload: (file) => {
      // 验证文件类型
      const isImage = file.type?.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      
      // 验证文件大小 (10MB)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB！');
        return false;
      }
      
      return false; // 阻止自动上传
    },
    onChange: (info) => {
      setFileList(info.fileList);
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
    }
  };

  // 执行上传和分析
  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择要分析的图片');
      return;
    }

    if (fileList.length > 1) {
      message.warning('页面分析暂时只支持单个文件上传');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      // 添加文件（只取第一个）
      const file = fileList[0];
      if (file.originFileObj) {
        formData.append('files', file.originFileObj);
      }

      // 添加页面名称
      if (pageNames.trim()) {
        formData.append('page_name', pageNames.trim());
      }

      // 添加描述信息
      formData.append('description', '请分析页面中的UI元素，不需要生成测试脚本');

      const response = await fetch('/api/v1/web/page-analysis/upload-and-analyze', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          message.success('分析任务已创建，正在处理...');

          // 清空文件列表和页面名称
          setFileList([]);
          setPageNames('');

          // 启动SSE连接监听分析进度
          if (result.data && result.data.session_id) {
            startSSEConnection(result.data.session_id);
          }

          // 立即刷新列表以显示"分析中"状态的记录
          setTimeout(() => {
            loadAnalysisRecords();
          }, 500);

          // 开始实时监听状态变化
          startStatusMonitoring(result.data.session_id);
        } else {
          // 如果不是JSON响应，读取文本内容
          const text = await response.text();
          console.log('非JSON响应:', text);
          message.success('分析任务已创建，正在处理...');

          // 清空文件列表和页面名称
          setFileList([]);
          setPageNames('');

          // 刷新列表
          loadAnalysisRecords();
        }
      } else {
        // 处理错误响应
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            message.error(error.detail || error.message || '上传失败');
          } else {
            const errorText = await response.text();
            console.error('错误响应:', errorText);
            message.error(`上传失败: ${response.status} ${response.statusText}`);
          }
        } catch (parseError) {
          console.error('解析错误响应失败:', parseError);
          message.error(`上传失败: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 启动状态监听
  const startStatusMonitoring = (sessionId: string) => {
    console.log('开始监听状态变化:', sessionId);

    // 每1秒刷新一次列表，持续30秒
    let refreshCount = 0;
    const maxRefreshCount = 30;

    const statusInterval = setInterval(() => {
      refreshCount++;
      loadAnalysisRecords();

      if (refreshCount >= maxRefreshCount) {
        clearInterval(statusInterval);
        console.log('状态监听结束');
      }
    }, 1000);

    // 存储interval ID以便后续清理
    (window as any).statusMonitoringInterval = statusInterval;
  };

  // 启动SSE连接监听分析进度
  const startSSEConnection = (sessionId: string) => {
    console.log('启动SSE连接:', sessionId);

    // 显示分析进度
    setCurrentAnalysis({
      visible: true,
      sessionId: sessionId,
      progress: 0,
      status: 'connecting',
      currentStep: '正在连接分析服务...'
    });

    const eventSource = new EventSource(`/api/v1/web/page-analysis/stream/${sessionId}`);

    eventSource.onopen = () => {
      console.log('SSE连接已建立');
      setCurrentAnalysis(prev => ({
        ...prev,
        status: 'connected',
        currentStep: '连接成功，开始分析...',
        progress: 10
      }));
    };

    // 处理会话初始化事件
    eventSource.addEventListener('session', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('会话已连接:', data);
        setCurrentAnalysis(prev => ({
          ...prev,
          status: 'analyzing',
          currentStep: '正在分析页面内容...',
          progress: 20
        }));
      } catch (e) {
        console.error('解析会话事件失败:', e);
      }
    });

    // 处理主要的消息事件
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到消息:', data);

        // 根据消息内容更新进度
        if (data.content) {
          const content = data.content;
          let progress = 30; // 默认进度

          // 根据消息内容判断进度
          if (content.includes('开始页面分析')) {
            progress = 10;
          } else if (content.includes('正在分析') && content.includes('0%')) {
            progress = 20;
          } else if (content.includes('正在分析页面元素')) {
            progress = 40;
          } else if (content.includes('正在分析') && content.includes('%')) {
            // 尝试从消息中提取百分比
            const match = content.match(/(\d+)%/);
            if (match) {
              progress = Math.min(parseInt(match[1]) + 20, 90);
            } else {
              progress = 60;
            }
          } else if (content.includes('保存分析结果') || content.includes('保存到知识库')) {
            progress = 80;
          } else if (content.includes('存储完成') || content.includes('分析结果已保存') || content.includes('✅')) {
            progress = 95;
          } else if (content.includes('分析完成') || content.includes('保存完成')) {
            progress = 100;
          }

          setCurrentAnalysis(prev => ({
            ...prev,
            currentStep: content,
            progress: Math.max(progress, prev.progress) // 确保进度不倒退
          }));

          // 如果检测到完成消息，立即触发完成流程
          if (content.includes('存储完成') || content.includes('分析结果已保存') || content.includes('页面分析结果存储完成')) {
            console.log('检测到存储完成消息，立即更新状态');
            setCurrentAnalysis(prev => ({
              ...prev,
              progress: 100,
              status: 'completed',
              currentStep: '分析完成！'
            }));

            message.success('页面分析完成！');
            eventSource.close();

            // 清理状态监听
            if ((window as any).statusMonitoringInterval) {
              clearInterval((window as any).statusMonitoringInterval);
            }

            // 立即刷新列表，不延迟
            setTimeout(() => {
              setCurrentAnalysis(prev => ({ ...prev, visible: false }));
              loadAnalysisRecords();
              loadKnowledgeBaseSummary();
            }, 500);
          }
        }
      } catch (e) {
        console.error('解析消息事件失败:', e);
      }
    });

    // 处理最终结果事件
    eventSource.addEventListener('final_result', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到最终结果:', data);

        // 更新进度到100%
        setCurrentAnalysis(prev => ({
          ...prev,
          progress: 100,
          status: 'completed',
          currentStep: '分析完成！'
        }));

        message.success('页面分析完成！');

        // 关闭连接
        eventSource.close();

        // 延迟隐藏进度并刷新列表
        setTimeout(() => {
          setCurrentAnalysis(prev => ({ ...prev, visible: false }));
          loadAnalysisRecords();
          loadKnowledgeBaseSummary();
        }, 2000);
      } catch (e) {
        console.error('解析最终结果事件失败:', e);
        // 确保即使出错也能完成流程
        setCurrentAnalysis(prev => ({
          ...prev,
          progress: 100,
          status: 'completed',
          currentStep: '分析完成！'
        }));
        message.success('页面分析完成！');
        eventSource.close();
        setTimeout(() => {
          setCurrentAnalysis(prev => ({ ...prev, visible: false }));
          loadAnalysisRecords();
          loadKnowledgeBaseSummary();
        }, 2000);
      }
    });

    // 处理关闭事件
    eventSource.addEventListener('close', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('连接关闭:', data);

        // 如果还没有完成，设置为完成状态
        setCurrentAnalysis(prev => {
          if (prev.status !== 'completed') {
            return {
              ...prev,
              progress: 100,
              status: 'completed',
              currentStep: '分析完成！'
            };
          }
          return prev;
        });

        message.success('页面分析完成！');

        // 关闭连接
        eventSource.close();

        // 延迟隐藏进度并刷新列表
        setTimeout(() => {
          setCurrentAnalysis(prev => ({ ...prev, visible: false }));
          loadAnalysisRecords();
          loadKnowledgeBaseSummary();
        }, 2000);
      } catch (e) {
        console.error('解析关闭事件失败:', e);
        // 确保即使出错也能完成流程
        setCurrentAnalysis(prev => ({
          ...prev,
          progress: 100,
          status: 'completed',
          currentStep: '分析完成！'
        }));
        message.success('页面分析完成！');
        eventSource.close();
        setTimeout(() => {
          setCurrentAnalysis(prev => ({ ...prev, visible: false }));
          loadAnalysisRecords();
          loadKnowledgeBaseSummary();
        }, 2000);
      }
    });

    // 处理错误事件
    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.error('分析错误:', data);
        setCurrentAnalysis(prev => ({
          ...prev,
          status: 'failed',
          currentStep: `分析失败: ${data.message || '未知错误'}`
        }));
        message.error(`分析失败: ${data.message || '未知错误'}`);
        eventSource.close();

        // 延迟隐藏进度
        setTimeout(() => {
          setCurrentAnalysis(prev => ({ ...prev, visible: false }));
        }, 3000);
      } catch (e) {
        console.error('解析错误事件失败:', e);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      setCurrentAnalysis(prev => ({
        ...prev,
        status: 'failed',
        currentStep: '连接中断，请刷新页面重试'
      }));
      message.error('连接中断，请刷新页面重试');
      eventSource.close();

      // 延迟隐藏进度
      setTimeout(() => {
        setCurrentAnalysis(prev => ({ ...prev, visible: false }));
      }, 3000);
    };

    // 添加定时器检查分析状态和实时更新列表
    const checkAnalysisStatus = (currentSessionId: string) => {
      // 更频繁地刷新列表以显示状态变化
      const listRefreshInterval = setInterval(() => {
        loadAnalysisRecords();
      }, 1500); // 每1.5秒刷新一次列表

      // 检查分析完成状态
      const statusCheckInterval = setInterval(async () => {
        try {
          // 检查数据库中的分析状态
          const response = await fetch('/api/v1/web/page-analysis/pages?page=1&page_size=10');
          if (response.ok) {
            const data = await response.json();
            const currentRecord = data.data.find((record: any) =>
              record.session_id === currentSessionId && record.analysis_status === 'completed'
            );

            if (currentRecord) {
              console.log('检测到分析完成，更新状态');
              setCurrentAnalysis(prev => ({
                ...prev,
                progress: 100,
                status: 'completed',
                currentStep: '分析完成！'
              }));

              message.success('页面分析完成！');
              eventSource.close();
              clearInterval(statusCheckInterval);
              clearInterval(listRefreshInterval);

              // 最后一次刷新列表并隐藏进度
              setTimeout(() => {
                setCurrentAnalysis(prev => ({ ...prev, visible: false }));
                loadAnalysisRecords();
                loadKnowledgeBaseSummary();
              }, 1000);
            }
          }
        } catch (error) {
          console.error('检查分析状态失败:', error);
        }
      }, 2000); // 每2秒检查一次完成状态

      // 60秒后停止检查
      setTimeout(() => {
        clearInterval(statusCheckInterval);
        clearInterval(listRefreshInterval);
      }, 60000);
    };

    // 启动状态检查，传入当前会话ID
    checkAnalysisStatus(sessionId);
  };

  // 查看分析结果
  const viewAnalysisResult = async (record: PageAnalysisRecord) => {
    if (record.status !== 'completed') {
      message.warning('分析尚未完成');
      return;
    }

    try {
      const response = await fetch(`/api/v1/web/page-analysis/${record.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('API返回的数据:', data); // 调试日志
        console.log('元素数据:', data.data.elements); // 调试元素数据
        setSelectedRecord(record);
        // 将API返回的数据转换为前端期望的格式
        const rawElements = data.data.elements || [];
        const parsedElements = data.data.parsed_ui_elements || [];

        // 转换UI元素数据格式
        const uiElements = rawElements.length > 0 ? rawElements.map((element: any) => ({
          id: element.id,
          name: element.element_name,
          element_type: element.element_type,
          description: element.element_description,
          text_content: element.element_data?.text_content || '',
          position: element.element_data?.position || {},
          visual_features: element.element_data?.visual_features || {},
          functionality: element.element_data?.functionality || '',
          interaction_state: element.element_data?.interaction_state || '',
          confidence_score: element.confidence_score || 0
        })) : parsedElements.map((element: any) => ({
          id: element.id,
          name: element.name,
          element_type: element.element_type,
          description: element.description,
          text_content: element.text_content || '',
          position: element.position || {},
          visual_features: element.visual_features || {},
          functionality: element.functionality || '',
          interaction_state: element.interaction_state || '',
          confidence_score: element.confidence_score || 0
        }));

        const analysisResult = {
          page_title: data.data.page_name,
          page_type: data.data.page_type,
          main_content: data.data.page_description,
          ui_elements: uiElements,
          confidence_score: data.data.confidence_score,
          analysis_summary: data.data.analysis_summary,
          processing_time: data.data.processing_time
        };
        console.log('转换后的分析结果:', analysisResult); // 调试转换结果
        console.log('UI元素数量:', uiElements.length); // 调试UI元素数量
        setAnalysisResult(analysisResult);
        setShowResultModal(true);
      } else {
        message.error('获取分析结果失败');
      }
    } catch (error) {
      console.error('获取分析结果失败:', error);
      message.error('获取分析结果失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<PageAnalysisRecord> = [
    {
      title: '页面名称',
      dataIndex: 'page_name',
      key: 'page_name',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong>{text || '未命名页面'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.original_filename}
          </Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
          processing: { color: 'processing', icon: <LoadingOutlined />, text: '分析中' },
          completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || {
          color: 'default',
          icon: <InfoCircleOutlined />,
          text: status || '未知'
        };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '分析结果',
      key: 'analysis_info',
      width: 200,
      render: (_, record) => {
        if (record.status === 'completed') {
          return (
            <div>
              <div>
                <Text>置信度: </Text>
                <Progress
                  percent={record.confidence_score ? Math.round(record.confidence_score * 100) : 0}
                  size="small"
                  style={{ width: 80 }}
                />
              </div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                UI元素: {record.ui_elements_count || 0} 个
              </Text>
            </div>
          );
        }
        return <Text type="secondary">-</Text>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看结果">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              disabled={record.status !== 'completed'}
              onClick={() => viewAnalysisResult(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除页面分析记录 "${record.page_name}" 吗？`,
                  onOk: () => deleteAnalysisRecord(record.id)
                });
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // 辅助函数
  const getElementTypeColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      'button': '#1890ff',
      'input': '#52c41a',
      'link': '#722ed1',
      'text': '#666666',
      'image': '#fa8c16',
      'form': '#13c2c2',
      'container': '#eb2f96',
      'navigation': '#f5222d',
      'default': '#8c8c8c'
    };
    return colorMap[type.toLowerCase()] || colorMap.default;
  };

  const getElementTypeIcon = (type: string): string => {
    const iconMap: { [key: string]: string } = {
      'button': '🔘',
      'input': '📝',
      'link': '🔗',
      'text': '📄',
      'image': '🖼️',
      'form': '📋',
      'container': '📦',
      'navigation': '🧭',
      'default': '🔧'
    };
    return iconMap[type.toLowerCase()] || iconMap.default;
  };

  // 渲染知识库统计卡片
  const renderKnowledgeBaseStats = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small" className="stats-card">
            <Statistic
              title="总页面数"
              value={knowledgeBaseSummary?.total_pages || 0}
              prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small" className="stats-card">
            <Statistic
              title="页面类型"
              value={knowledgeBaseSummary?.page_types?.length || 0}
              suffix="种"
              prefix={<BulbOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small" className="stats-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <BarChartOutlined style={{ color: '#722ed1', marginRight: '4px' }} />
                热门页面类型
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
                {knowledgeBaseSummary?.page_types?.slice(0, 3).map((type, index) => (
                  <Tag key={index} color="processing" style={{ margin: '2px' }}>
                    {type.type} ({type.count})
                  </Tag>
                )) || <Text type="secondary">暂无数据</Text>}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </motion.div>
  );

  return (
    <div className="page-analysis-container">
      {/* 页面标题和操作区 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="page-header"
      >
        <div className="header-content">
          <div className="header-left">
            <Space size="large">
              <div className="header-icon">
                <RobotOutlined />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                  AI页面分析
                </Title>
                <Paragraph style={{ margin: 0, color: '#666' }}>
                  智能识别页面UI元素，构建测试知识库
                </Paragraph>
              </div>
            </Space>
          </div>
          <div className="header-right">
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadAnalysisRecords();
                  loadKnowledgeBaseSummary();
                }}
                loading={loading}
              >
                刷新数据
              </Button>
              <Button
                danger
                onClick={() => {
                  Modal.confirm({
                    title: '清理卡住的任务',
                    content: '确定要清理所有卡住的分析任务吗？这将重置所有超过10分钟仍在处理中的任务。',
                    onOk: cleanupStuckTasks
                  });
                }}
              >
                清理任务
              </Button>
            </Space>
          </div>
        </div>
      </motion.div>

      {/* 知识库统计 */}
      {renderKnowledgeBaseStats()}

      {/* 主要内容区域 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          className="main-tabs"
        >
          <TabPane
            tab={
              <Space>
                <CloudUploadOutlined />
                <span>上传分析</span>
              </Space>
            }
            key="upload"
          >
            <Card className="upload-card">
              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <div className="upload-section">
                    <Title level={4}>
                      <FileImageOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                      上传页面截图
                    </Title>
                    <Paragraph type="secondary">
                      支持 PNG、JPG、JPEG 格式，单个文件不超过 10MB
                    </Paragraph>

                    <Upload.Dragger
                      {...uploadProps}
                      className="upload-dragger"
                    >
                      <p className="ant-upload-drag-icon">
                        <CloudUploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                      </p>
                      <p className="ant-upload-text">
                        点击或拖拽文件到此区域上传
                      </p>
                      <p className="ant-upload-hint">
                        AI将自动识别页面中的UI元素和交互组件
                      </p>
                    </Upload.Dragger>

                    {fileList.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <Text strong>已选择文件：</Text>
                        <List
                          size="small"
                          dataSource={fileList}
                          renderItem={(file) => (
                            <List.Item>
                              <Space>
                                <FileImageOutlined />
                                <Text>{file.name}</Text>
                                <Text type="secondary">
                                  ({(file.size! / 1024 / 1024).toFixed(2)} MB)
                                </Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </Col>

                <Col xs={24} lg={12}>
                  <div className="config-section">
                    <Title level={4}>
                      <SettingOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                      分析配置
                    </Title>

                    <Form layout="vertical">
                      <Form.Item label="页面名称（可选）">
                        <Input
                          placeholder="为页面起一个描述性的名称，如：登录页面、商品列表页等"
                          value={pageNames}
                          onChange={(e) => setPageNames(e.target.value)}
                          prefix={<ScanOutlined />}
                        />
                      </Form.Item>

                      <Form.Item>
                        <Alert
                          message="AI分析说明"
                          description={
                            <div>
                              <p>• 自动识别页面中的按钮、输入框、链接等UI元素</p>
                              <p>• 分析元素的位置、样式和交互状态</p>
                              <p>• 生成结构化的页面元素数据</p>
                              <p>• 结果将保存到知识库，用于后续测试生成</p>
                            </div>
                          }
                          type="info"
                          showIcon
                          icon={<InfoCircleOutlined />}
                        />
                      </Form.Item>
                    </Form>

                    <div className="action-buttons">
                      <Space size="middle">
                        <Button
                          type="primary"
                          size="large"
                          icon={<RobotOutlined />}
                          onClick={handleUpload}
                          loading={uploading}
                          disabled={fileList.length === 0}
                          className="analyze-button"
                        >
                          {uploading ? '正在分析...' : '开始AI分析'}
                        </Button>
                        <Button
                          size="large"
                          onClick={() => {
                            setFileList([]);
                            setPageNames('');
                          }}
                          disabled={fileList.length === 0}
                        >
                          清空
                        </Button>
                      </Space>
                    </div>

                    {/* 分析进度显示 */}
                    {currentAnalysis.visible && (
                      <Card
                        size="small"
                        title={
                          <Space>
                            <RobotOutlined spin={currentAnalysis.status === 'analyzing'} />
                            <span>分析进度</span>
                          </Space>
                        }
                        style={{ marginTop: 16 }}
                      >
                        <div style={{ padding: '16px 0' }}>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>当前状态：</Text>
                            <Text style={{ marginLeft: 8 }}>
                              {currentAnalysis.currentStep}
                            </Text>
                          </div>

                          <Progress
                            percent={currentAnalysis.progress}
                            status={
                              currentAnalysis.status === 'failed' ? 'exception' :
                              currentAnalysis.status === 'completed' ? 'success' : 'active'
                            }
                            strokeColor={
                              currentAnalysis.status === 'failed' ? '#ff4d4f' :
                              currentAnalysis.status === 'completed' ? '#52c41a' : '#1890ff'
                            }
                            showInfo={true}
                          />

                          <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                            <Text type="secondary">
                              会话ID: {currentAnalysis.sessionId}
                            </Text>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <Space>
                <DatabaseOutlined />
                <span>分析记录</span>
                <Badge count={analysisRecords.length} showZero />
              </Space>
            }
            key="records"
          >
            <Card className="records-card">
              <Table
                columns={columns}
                dataSource={analysisRecords}
                rowKey="id"
                loading={loading}
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  onChange: (page, pageSize) => {
                    loadAnalysisRecords(page, pageSize);
                  }
                }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <div>
                          <Text type="secondary">暂无分析记录</Text>
                          <br />
                          <Button
                            type="link"
                            onClick={() => setActiveTab('upload')}
                            style={{ padding: 0 }}
                          >
                            立即上传页面截图进行分析
                          </Button>
                        </div>
                      }
                    />
                  )
                }}
                className="records-table"
              />
            </Card>
          </TabPane>

          <TabPane
            tab={
              <Space>
                <SearchOutlined />
                <span>知识库搜索</span>
              </Space>
            }
            key="search"
          >
            <Card className="search-card">
              <Row gutter={24}>
                <Col xs={24} lg={16}>
                  <div className="search-section">
                    <Title level={4}>
                      <SearchOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                      搜索页面分析知识库
                    </Title>
                    <Paragraph type="secondary">
                      在已分析的页面中搜索相似的UI元素和页面结构
                    </Paragraph>

                    <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                      <Input
                        placeholder="输入页面名称、功能描述或UI元素类型..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onPressEnter={handleKnowledgeBaseSearch}
                        size="large"
                      />
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleKnowledgeBaseSearch}
                        loading={searchLoading}
                        size="large"
                      >
                        搜索
                      </Button>
                    </Space.Compact>

                    {searchResults.length > 0 && (
                      <div>
                        <Text strong>搜索结果 ({searchResults.length} 个页面)：</Text>
                        <List
                          dataSource={searchResults}
                          renderItem={(item: any) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={
                                  <Avatar
                                    style={{
                                      backgroundColor: '#1890ff',
                                      color: '#fff'
                                    }}
                                  >
                                    📄
                                  </Avatar>
                                }
                                title={
                                  <Space>
                                    <Text strong>{item.page_name}</Text>
                                    <Tag color="blue">{item.page_type}</Tag>
                                    {item.confidence_score && (
                                      <Tag color="success">
                                        {Math.round(item.confidence_score * 100)}%
                                      </Tag>
                                    )}
                                  </Space>
                                }
                                description={
                                  <div>
                                    <Paragraph style={{ margin: 0, marginBottom: 8 }}>
                                      {item.main_content || item.page_title}
                                    </Paragraph>
                                    {item.ui_elements && item.ui_elements.length > 0 && (
                                      <div>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          UI元素: {item.ui_elements.length} 个
                                        </Text>
                                      </div>
                                    )}
                                  </div>
                                }
                              />
                              <Button
                                type="link"
                                onClick={() => {
                                  // 查看详细结果
                                  viewAnalysisResult({
                                    id: item.id,
                                    page_name: item.page_name,
                                    status: 'completed'
                                  } as PageAnalysisRecord);
                                }}
                              >
                                查看详情
                              </Button>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </Col>

                <Col xs={24} lg={8}>
                  <div className="search-tips">
                    <Title level={4}>
                      <BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />
                      搜索技巧
                    </Title>

                    <Alert
                      message="搜索建议"
                      description={
                        <div>
                          <p>• 使用页面功能描述：如"登录页面"、"商品列表"</p>
                          <p>• 搜索UI元素类型：如"按钮"、"输入框"、"表单"</p>
                          <p>• 使用页面特征：如"导航栏"、"侧边栏"</p>
                          <p>• 组合关键词：如"登录 表单 按钮"</p>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />

                    {knowledgeBaseSummary?.page_types && knowledgeBaseSummary.page_types.length > 0 && (
                      <div>
                        <Text strong>常见页面类型：</Text>
                        <div style={{ marginTop: 8 }}>
                          {knowledgeBaseSummary.page_types.map((type, index) => (
                            <Tag
                              key={index}
                              style={{ margin: '2px', cursor: 'pointer' }}
                              onClick={() => {
                                setSearchQuery(type.type);
                                handleKnowledgeBaseSearch();
                              }}
                            >
                              {type.type} ({type.count})
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>
          </TabPane>
        </Tabs>
      </motion.div>

      {/* 分析结果查看模态框 */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span>分析结果 - {selectedRecord?.page_name}</span>
          </Space>
        }
        open={showResultModal}
        onCancel={() => setShowResultModal(false)}
        footer={null}
        width={1000}
        className="result-modal"
      >
        {analysisResult ? (
          <div className="result-content">
            {/* 调试信息 */}
            <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '16px', fontSize: '12px' }}>
              <strong>调试信息:</strong><br/>
              页面标题: {analysisResult.page_title || '无'}<br/>
              页面类型: {analysisResult.page_type || '无'}<br/>
              UI元素数量: {analysisResult.ui_elements ? analysisResult.ui_elements.length : 0}<br/>
              置信度: {analysisResult.confidence_score || 0}
            </div>
            {/* 页面截图和基本信息 */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              {/* 页面截图 */}
              {selectedRecord?.image_path && (
                <div style={{ flex: '0 0 300px' }}>
                  <Card size="small" title="页面截图" style={{ height: 'fit-content' }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={`/api/v1/web/page-analysis/image/${selectedRecord.image_path}`}
                        alt={selectedRecord.image_filename || '页面截图'}
                        style={{
                          width: '100%',
                          maxHeight: '400px',
                          objectFit: 'contain',
                          border: '1px solid #d9d9d9',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onClick={() => handleImageClick(selectedRecord.image_path!)}
                        onMouseEnter={(e) => {
                          (e.target as HTMLImageElement).style.transform = 'scale(1.02)';
                          (e.target as HTMLImageElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLImageElement).style.transform = 'scale(1)';
                          (e.target as HTMLImageElement).style.boxShadow = 'none';
                        }}
                        onError={(e) => {
                          console.error('图片加载失败:', selectedRecord.image_path);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {/* 放大提示图标 */}
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        opacity: 0.8
                      }}>
                        🔍 点击放大
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      文件名: {selectedRecord.image_filename || '未知'}
                    </div>
                  </Card>
                </div>
              )}

              {/* 基本信息 */}
              <div style={{ flex: 1 }}>
                <Card size="small" title="页面基本信息">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="页面标题">
                      {analysisResult.page_title || '未识别'}
                    </Descriptions.Item>
                    <Descriptions.Item label="页面类型">
                      <Tag color="blue">{analysisResult.page_type || '未知'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="置信度">
                      <Progress
                        percent={analysisResult.confidence_score ? Math.round(analysisResult.confidence_score * 100) : 0}
                        size="small"
                        status={
                          (analysisResult.confidence_score || 0) > 0.8 ? 'success' :
                      (analysisResult.confidence_score || 0) > 0.6 ? 'normal' : 'exception'
                    }
                  />
                </Descriptions.Item>
                <Descriptions.Item label="处理时间">
                  {analysisResult.processing_time ? `${analysisResult.processing_time.toFixed(2)}秒` : '未知'}
                </Descriptions.Item>
                  </Descriptions>

                  {analysisResult.main_content && (
                    <div style={{ marginTop: 16 }}>
                      <Text strong>页面描述：</Text>
                      <Paragraph style={{ marginTop: 8 }}>
                        {analysisResult.main_content}
                      </Paragraph>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* UI元素列表 */}
            {analysisResult.ui_elements && analysisResult.ui_elements.length > 0 && (
              <Card size="small" title={`UI元素列表 (${analysisResult.ui_elements.length} 个)`}>
                <Collapse
                  size="small"
                  expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
                >
                  {analysisResult.ui_elements.map((element: UIElement, index) => (
                    <Collapse.Panel
                      key={element.id || index}
                      header={
                        <Space>
                          <Avatar
                            size="small"
                            style={{
                              backgroundColor: getElementTypeColor(element.element_type),
                              color: '#fff'
                            }}
                          >
                            {getElementTypeIcon(element.element_type)}
                          </Avatar>
                          <Text strong>{element.name || `元素${index + 1}`}</Text>
                          <Tag color="processing" size="small">{element.element_type}</Tag>
                          {element.confidence_score && (
                            <Tag
                              color={element.confidence_score > 0.8 ? 'success' : 'warning'}
                              size="small"
                            >
                              {Math.round(element.confidence_score * 100)}%
                            </Tag>
                          )}
                        </Space>
                      }
                    >
                      <div style={{ padding: '8px 0' }}>
                        {/* 基本信息 */}
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>描述：</Text>
                          <Paragraph style={{ margin: '4px 0 8px 0' }}>
                            {element.description || '无描述'}
                          </Paragraph>

                          {element.text_content && (
                            <div style={{ marginBottom: 8 }}>
                              <Text strong>文本内容：</Text>
                              <div style={{ marginTop: 4 }}>
                                <Text code>{element.text_content}</Text>
                              </div>
                            </div>
                          )}

                          {element.functionality && (
                            <div style={{ marginBottom: 8 }}>
                              <Text strong>功能：</Text>
                              <Paragraph style={{ margin: '4px 0' }}>
                                {element.functionality}
                              </Paragraph>
                            </div>
                          )}
                        </div>

                        {/* 详细JSON数据 */}
                        <Divider style={{ margin: '12px 0' }} />
                        <div>
                          <Space style={{ marginBottom: 8 }}>
                            <CodeOutlined />
                            <Text strong>完整元素数据</Text>
                          </Space>
                          <div
                            style={{
                              background: '#f5f5f5',
                              padding: '12px',
                              borderRadius: '6px',
                              border: '1px solid #d9d9d9',
                              maxHeight: '300px',
                              overflow: 'auto'
                            }}
                          >
                            <pre style={{
                              margin: 0,
                              fontSize: '12px',
                              lineHeight: '1.4',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {JSON.stringify(element, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              </Card>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Text type="secondary">没有分析结果数据</Text>
          </div>
        )}
      </Modal>

      {/* 图片预览Modal */}
      <Modal
        open={imagePreviewVisible}
        onCancel={handleImagePreviewClose}
        footer={null}
        width="95vw"
        style={{ top: 20 }}
        centered
        className="image-preview-modal"
        destroyOnClose
        maskClosable={true}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          maxHeight: '85vh',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <img
            src={previewImageUrl}
            alt="页面截图预览"
            style={{
              maxWidth: '100%',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              cursor: 'zoom-out'
            }}
            onClick={handleImagePreviewClose}
            onError={(e) => {
              console.error('预览图片加载失败:', previewImageUrl);
              message.error('图片加载失败');
              handleImagePreviewClose();
            }}
          />

          {/* 操作提示 */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1000
          }}>
            <span>🖱️ 点击图片关闭</span>
            <span>⌨️ 按 ESC 关闭</span>
            <span>🖱️ 点击外部区域关闭</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PageAnalysis;
