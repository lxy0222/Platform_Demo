import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Tabs,
  Upload,
  Input,
  Button,
  Form,
  Select,
  Space,
  Typography,
  Alert,
  Divider,
  Tag,
  Row,
  Col,
  Checkbox,
  message,
  Modal,
  List,
  Spin
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  SaveOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import YAMLViewer from '../../../components/YAMLViewer/YAMLViewer';

import {
  analyzeImageForTestCases,
  analyzeTextForTestCases,
  generateScriptsFromTestCases,
  getTestCaseAnalysisStatus,
  getGeneratedScripts,
  saveScriptFromSession,
  executeScript
} from '../../../services/api';
import './TestCaseCreation.css';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

interface TestScenario {
  scenario_id: string;
  scenario_name: string;
  description: string;
  category: string;
  priority: string;
  estimated_duration: string;
  preconditions: string[];
  test_steps: string[];
  expected_results: string[];
  test_data: Record<string, any>;
  tags: string[];
}

interface AnalysisResult {
  session_id: string;
  analysis_result: any;
  suggested_test_scenarios?: TestScenario[];
}

interface ScriptData {
  format: 'yaml' | 'playwright';
  content: string;
  filename: string;
  file_path?: string;
}

interface ScriptCollection {
  yaml?: ScriptData;
  playwright?: ScriptData;
}

const TestCaseCreation: React.FC = () => {
  // 基础状态
  const [form] = Form.useForm();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isImageAnalyzing, setIsImageAnalyzing] = useState(false);  // 图片分析loading
  const [isTextAnalyzing, setIsTextAnalyzing] = useState(false);    // 文字解析loading
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['playwright']);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // 测试用例状态
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isEditingScenario, setIsEditingScenario] = useState<string | null>(null);
  const [editingScenarioData, setEditingScenarioData] = useState<TestScenario | null>(null);

  // 脚本管理状态
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [scripts, setScripts] = useState<ScriptCollection>({});
  const [activeScriptTab, setActiveScriptTab] = useState<'yaml' | 'playwright'>('playwright');
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isExecutingScript, setIsExecutingScript] = useState(false);

  // 处理图片上传 - 立即分析
  const handleImageUpload = useCallback(async (file: any) => {
    setUploadedFile(file);

    // 立即分析图片
    await analyzeImageImmediately(file);

    return false; // 阻止自动上传
  }, []);

  // 立即分析图片
  const analyzeImageImmediately = useCallback(async (file: any) => {
    if (!file) return;

    setIsImageAnalyzing(true);  // 只设置图片分析loading
    setCurrentSessionId('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('test_description', '请分析这个界面并生成测试场景');
    formData.append('generate_formats', selectedFormats.join(','));

    try {
      const result = await analyzeImageForTestCases(formData);

      if (result.sse_endpoint && result.session_id) {
        setCurrentSessionId(result.session_id);
        toast.success('正在分析图片...');

        // 直接监听SSE结果，不显示过程
        startDirectSSEListening(result.session_id, result.sse_endpoint);
      } else {
        handleAnalysisComplete(result);
      }
    } catch (error: any) {
      setIsImageAnalyzing(false);  // 只重置图片分析loading
      toast.error(`图片分析失败: ${error.message}`);
    }
  }, [selectedFormats]);

  // 处理分析完成
  const handleAnalysisComplete = useCallback((result: any) => {
    console.log('🔍 handleAnalysisComplete 收到结果:', result);
    setAnalysisResult(result);
    setIsImageAnalyzing(false);  // 重置图片分析loading
    setIsTextAnalyzing(false);   // 重置文字解析loading

    if (result.session_id) {
      setCurrentSessionId(result.session_id);
    }

    // 解析建议的测试场景并填入文字输入框
    if (result.suggested_test_scenarios && result.suggested_test_scenarios.length > 0) {
      console.log('✅ 找到测试场景:', result.suggested_test_scenarios);
      const scenarios = result.suggested_test_scenarios;
      setTestScenarios(scenarios);

      // 将测试场景转换为结构化文字描述填入输入框
      const scenarioTexts = scenarios.map((scenario: TestScenario) => {
        // 构建场景标题和描述
        let scenarioText = `${scenario.scenario_name}: ${scenario.scenario_description || scenario.description}`;

        // 添加测试步骤
        if (scenario.test_steps && scenario.test_steps.length > 0) {
          const steps = scenario.test_steps.map(step => `- ${step}`).join('\n');
          scenarioText += '\n' + steps;
        }

        return scenarioText;
      }).join('\n\n');

      console.log('📝 准备填入输入框的文字:', scenarioTexts);

      form.setFieldsValue({
        test_description: scenarioTexts
      });

      toast.success(`已分析出 ${scenarios.length} 个测试场景并填入输入框`);
    } else {
      console.log('❌ 没有找到 suggested_test_scenarios，result 内容:', Object.keys(result));
      toast.success('图片分析完成');
    }
  }, [form]);

  // 解析文字描述为测试场景
  const parseTextToScenarios = useCallback((text: string): TestScenario[] => {
    const scenarios: TestScenario[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    let currentScenario: Partial<TestScenario> | null = null;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // 检查是否是场景标题（包含冒号的行）
      if (trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
        // 保存之前的场景
        if (currentScenario && currentScenario.scenario_name) {
          scenarios.push({
            scenario_id: `TC${Date.now()}_${scenarios.length + 1}`,
            scenario_name: currentScenario.scenario_name,
            description: currentScenario.description || '',
            category: '功能测试',
            priority: '中',
            estimated_duration: '2分钟',
            preconditions: [],
            test_steps: currentScenario.test_steps || [],
            expected_results: currentScenario.expected_results || ['功能正常工作'],
            test_data: {},
            tags: ['用户输入']
          });
        }

        // 开始新场景
        const [name, description] = trimmedLine.split(':').map(s => s.trim());
        currentScenario = {
          scenario_name: name,
          description: description,
          test_steps: [],
          expected_results: []
        };
      } else if (currentScenario && trimmedLine.startsWith('-')) {
        // 测试步骤
        const step = trimmedLine.substring(1).trim();
        if (!currentScenario.test_steps) currentScenario.test_steps = [];
        currentScenario.test_steps.push(step);
      } else if (currentScenario && trimmedLine) {
        // 其他描述信息
        if (currentScenario.description) {
          currentScenario.description += ' ' + trimmedLine;
        } else {
          currentScenario.description = trimmedLine;
        }
      }
    });

    // 保存最后一个场景
    if (currentScenario && currentScenario.scenario_name) {
      scenarios.push({
        scenario_id: `TC${Date.now()}_${scenarios.length + 1}`,
        scenario_name: currentScenario.scenario_name,
        description: currentScenario.description || '',
        category: '功能测试',
        priority: '中',
        estimated_duration: '2分钟',
        preconditions: [],
        test_steps: currentScenario.test_steps || [],
        expected_results: currentScenario.expected_results || ['功能正常工作'],
        test_data: {},
        tags: ['用户输入']
      });
    }

    return scenarios;
  }, []);

  // 处理文字描述生成测试场景
  const handleTextAnalysis = useCallback(async (values: any) => {
    if (!values.test_description || values.test_description.trim() === '') {
      message.error('请输入测试描述');
      return;
    }

    setIsTextAnalyzing(true);  // 只设置文字解析loading
    setCurrentSessionId('');

    try {
      // 首先尝试本地解析
      const localScenarios = parseTextToScenarios(values.test_description.trim());

      if (localScenarios.length > 0) {
        // 本地解析成功，直接使用
        setTestScenarios(localScenarios);
        setIsAnalyzing(false);
        toast.success(`已解析出 ${localScenarios.length} 个测试场景`);
      } else {
        // 本地解析失败，使用AI分析
        const result = await analyzeTextForTestCases({
          test_description: values.test_description,
          additional_context: values.additional_context,
          generate_formats: selectedFormats.join(',')
        });

        if (result.sse_endpoint && result.session_id) {
          setCurrentSessionId(result.session_id);
          toast.success('正在AI分析...');

          // 直接监听SSE结果，不显示过程
          startDirectSSEListening(result.session_id, result.sse_endpoint);
        } else {
          handleAnalysisComplete(result);
        }
      }
    } catch (error: any) {
      setIsTextAnalyzing(false);  // 只重置文字解析loading
      toast.error(`分析失败: ${error.message}`);
    }
  }, [selectedFormats, parseTextToScenarios, handleAnalysisComplete]);



  // 直接监听SSE结果，不显示过程
  const startDirectSSEListening = useCallback((sessionId: string, sseEndpoint: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const sseUrl = sseEndpoint.startsWith('http') ? sseEndpoint : `${baseUrl}${sseEndpoint}`;

    console.log('开始直接SSE监听:', sseUrl);

    const eventSource = new EventSource(sseUrl);

    const handleEvent = (eventType: string, event: MessageEvent) => {
      try {
        let jsonData = event.data;

        // 处理SSE格式数据
        if (typeof jsonData === 'string' && jsonData.includes('data: ')) {
          const lines = jsonData.split('\n');
          const dataLine = lines.find(line => line.startsWith('data: '));
          if (dataLine) {
            jsonData = dataLine.substring(6);
          } else {
            return;
          }
        }

        const data = JSON.parse(jsonData);

        // 只处理最终结果
        if (eventType === 'final_result' || data.is_final) {
          console.log('🎯 收到最终结果:', data);
          console.log('📊 数据类型:', eventType, '是否最终:', data.is_final);
          eventSource.close();

          if (data.result) {
            console.log('✅ 调用 handleAnalysisComplete，传入 data.result:', data.result);
            handleAnalysisComplete(data.result);
          } else {
            console.log('❌ data.result 为空，完整数据:', data);
          }
        } else {
          console.log('📨 收到中间消息:', eventType, data);
        }
      } catch (error) {
        console.error(`解析SSE事件失败:`, error);
      }
    };

    // 注册事件监听器
    ['final_result', 'message'].forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => handleEvent(eventType, event));
    });

    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      eventSource.close();
      setIsImageAnalyzing(false);  // 重置图片分析loading
      setIsTextAnalyzing(false);   // 重置文字解析loading
      toast.error('分析连接中断');
    };

    // 设置超时
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
        setIsImageAnalyzing(false);  // 重置图片分析loading
        setIsTextAnalyzing(false);   // 重置文字解析loading
        toast.error('分析超时');
      }
    }, 60000); // 60秒超时

  }, [handleAnalysisComplete]);

  // 添加新的测试场景
  const handleAddTestScenario = useCallback(() => {
    const newScenario: TestScenario = {
      scenario_id: `TC${Date.now()}`,
      scenario_name: '新测试场景',
      description: '',
      category: '功能测试',
      priority: '中',
      estimated_duration: '2分钟',
      preconditions: [],
      test_steps: [],
      expected_results: [],
      test_data: {},
      tags: []
    };
    setTestScenarios([...testScenarios, newScenario]);
    setIsEditingScenario(newScenario.scenario_id);
    setEditingScenarioData(newScenario);
  }, [testScenarios]);

  // 编辑测试场景
  const handleEditScenario = useCallback((scenario: TestScenario) => {
    setIsEditingScenario(scenario.scenario_id);
    setEditingScenarioData({ ...scenario });
  }, []);

  // 保存编辑的测试场景
  const handleSaveScenario = useCallback(() => {
    if (!editingScenarioData) return;

    const updatedScenarios = testScenarios.map(scenario =>
      scenario.scenario_id === editingScenarioData.scenario_id
        ? editingScenarioData
        : scenario
    );
    setTestScenarios(updatedScenarios);
    setIsEditingScenario(null);
    setEditingScenarioData(null);
    toast.success('测试场景已保存');
  }, [editingScenarioData, testScenarios]);

  // 删除测试场景
  const handleDeleteScenario = useCallback((scenarioId: string) => {
    const updatedScenarios = testScenarios.filter(scenario => scenario.scenario_id !== scenarioId);
    setTestScenarios(updatedScenarios);
    setSelectedScenarios(selectedScenarios.filter(id => id !== scenarioId));
    toast.success('测试场景已删除');
  }, [testScenarios, selectedScenarios]);

  // 生成脚本
  const handleGenerateScripts = useCallback(async () => {
    if (selectedScenarios.length === 0) {
      message.error('请至少选择一个测试场景');
      return;
    }

    const selectedTestScenarios = testScenarios.filter(scenario =>
      selectedScenarios.includes(scenario.scenario_id)
    );

    try {
      toast.success('开始生成脚本...');

      const result = await generateScriptsFromTestCases({
        session_id: currentSessionId,
        test_scenarios: selectedTestScenarios,
        generate_formats: selectedFormats
      });

      if (result.status === 'success') {
        toast.success('脚本生成已启动');
        // 等待一段时间后获取生成的脚本
        setTimeout(async () => {
          if (currentSessionId) {
            await fetchGeneratedScripts(currentSessionId);
          }
        }, 3000);
      }
    } catch (error: any) {
      toast.error(`脚本生成失败: ${error.message}`);
    }
  }, [selectedScenarios, testScenarios, currentSessionId, selectedFormats]);

  // 获取生成的脚本
  const fetchGeneratedScripts = useCallback(async (sessionId: string) => {
    try {
      const response = await getGeneratedScripts(sessionId);
      
      if (response.status === 'success' && response.scripts && response.scripts.length > 0) {
        const newScripts: ScriptCollection = {};
        
        response.scripts.forEach((script: any) => {
          const scriptData: ScriptData = {
            format: script.format as 'yaml' | 'playwright',
            content: script.content,
            filename: script.filename,
            file_path: script.file_path
          };

          if (script.format === 'yaml') {
            newScripts.yaml = scriptData;
          } else if (script.format === 'playwright') {
            newScripts.playwright = scriptData;
          }
        });

        setScripts(newScripts);
        setShowScriptEditor(true);
        setActiveScriptTab(newScripts.yaml ? 'yaml' : 'playwright');
        
        toast.success(`成功加载 ${response.scripts.length} 个脚本！`);
      }
    } catch (error: any) {
      console.error('获取脚本失败:', error);
      toast.error('获取脚本失败');
    }
  }, []);

  return (
    <div className="test-case-creation">
      <Card title="测试用例创建" className="main-card">
        <Tabs defaultActiveKey="test-creation">
          <TabPane tab="测试场景创建" key="test-creation">
            <Form form={form} onFinish={handleTextAnalysis} layout="vertical">
              <Alert
                message="创建方式说明"
                description="您可以直接输入测试场景描述，或者上传界面截图让AI自动分析生成测试场景。图片上传后会立即分析并填入下方输入框。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="上传图片（可选）">
                    <Upload
                      beforeUpload={handleImageUpload}
                      showUploadList={false}
                      accept="image/*"
                      disabled={isImageAnalyzing}
                    >
                      <Button
                        icon={<UploadOutlined />}
                        loading={isImageAnalyzing}
                        disabled={isImageAnalyzing}
                      >
                        {isImageAnalyzing ? '分析中...' : uploadedFile ? uploadedFile.name : '选择图片自动分析'}
                      </Button>
                    </Upload>
                    {uploadedFile && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        已上传: {uploadedFile.name}
                      </div>
                    )}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="生成格式">
                    <Checkbox.Group
                      value={selectedFormats}
                      onChange={setSelectedFormats}
                      options={[
                        { label: 'YAML', value: 'yaml' },
                        { label: 'Playwright + MidScene.js', value: 'playwright' }
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="test_description"
                label="测试场景描述"
                rules={[{ required: true, message: '请输入测试场景描述' }]}
                extra="请描述要测试的功能场景。支持多行输入，每行一个场景。格式：场景名称: 场景描述"
              >
                <TextArea
                  rows={6}
                  placeholder={`请输入测试场景描述，例如：
登录功能测试: 验证用户通过用户名密码登录系统
- 输入有效用户名
- 输入正确密码
- 点击登录按钮
- 验证登录成功

注册功能测试: 验证新用户注册流程
- 填写注册信息
- 提交注册表单
- 验证注册成功`}
                />
              </Form.Item>

              <Form.Item name="additional_context" label="附加上下文（可选）">
                <TextArea rows={2} placeholder="提供额外的测试上下文信息..." />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isTextAnalyzing}  // 只在文字解析时显示loading
                  icon={<CheckCircleOutlined />}
                  size="large"
                >
                  解析测试场景
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="测试用例管理" key="test-cases">
            <div className="test-scenarios-section">
              <div className="section-header">
                <Title level={4}>测试场景</Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddTestScenario}
                >
                  添加测试场景
                </Button>
              </div>

              {testScenarios.length > 0 && (
                <>
                  <List
                    dataSource={testScenarios}
                    renderItem={(scenario) => (
                      <List.Item
                        key={scenario.scenario_id}
                        actions={[
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => handleEditScenario(scenario)}
                          >
                            编辑
                          </Button>,
                          <Button
                            icon={<DeleteOutlined />}
                            danger
                            onClick={() => handleDeleteScenario(scenario.scenario_id)}
                          >
                            删除
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <div>
                              <Checkbox
                                checked={selectedScenarios.includes(scenario.scenario_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedScenarios([...selectedScenarios, scenario.scenario_id]);
                                  } else {
                                    setSelectedScenarios(selectedScenarios.filter(id => id !== scenario.scenario_id));
                                  }
                                }}
                              />
                              <span style={{ marginLeft: 8 }}>{scenario.scenario_name}</span>
                              <Tag color="blue" style={{ marginLeft: 8 }}>{scenario.priority}</Tag>
                              <Tag color="green">{scenario.category}</Tag>
                            </div>
                          }
                          description={
                            <div>
                              <Text>{scenario.description}</Text>
                              <div style={{ marginTop: 8 }}>
                                <Text type="secondary">预计时长: {scenario.estimated_duration}</Text>
                                <Divider type="vertical" />
                                <Text type="secondary">步骤数: {scenario.test_steps.length}</Text>
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />

                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CodeOutlined />}
                      onClick={handleGenerateScripts}
                      disabled={selectedScenarios.length === 0}
                    >
                      生成选中场景的脚本 ({selectedScenarios.length})
                    </Button>
                  </div>
                </>
              )}

              {testScenarios.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Text type="secondary">
                    暂无测试场景，请先上传图片进行分析或手动添加测试场景
                  </Text>
                </div>
              )}
            </div>
          </TabPane>
        </Tabs>



        {/* 脚本编辑器 */}
        {showScriptEditor && (
          <Card title="生成的脚本" style={{ marginTop: 16 }}>
            <Tabs activeKey={activeScriptTab} onChange={(key) => setActiveScriptTab(key as 'yaml' | 'playwright')}>
              {scripts.yaml && (
                <TabPane tab="YAML脚本" key="yaml">
                  <Space style={{ marginBottom: 16 }}>
                    <Button icon={<SaveOutlined />} loading={isSavingScript}>
                      保存到数据库
                    </Button>
                    <Button icon={<PlayCircleOutlined />} loading={isExecutingScript}>
                      执行脚本
                    </Button>
                    <Button icon={<DownloadOutlined />}>
                      下载脚本
                    </Button>
                  </Space>
                  <YAMLViewer content={scripts.yaml.content} />
                </TabPane>
              )}
              
              {scripts.playwright && (
                <TabPane tab="Playwright + MidScene.js" key="playwright">
                  <Space style={{ marginBottom: 16 }}>
                    <Button icon={<SaveOutlined />} loading={isSavingScript}>
                      保存到数据库
                    </Button>
                    <Button icon={<PlayCircleOutlined />} loading={isExecutingScript}>
                      执行脚本
                    </Button>
                    <Button icon={<DownloadOutlined />}>
                      下载脚本
                    </Button>
                  </Space>
                  <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
                    {scripts.playwright.content}
                  </pre>
                </TabPane>
              )}
            </Tabs>
          </Card>
        )}

        {/* 测试场景编辑模态框 */}
        <Modal
          title="编辑测试场景"
          open={!!isEditingScenario}
          onOk={handleSaveScenario}
          onCancel={() => {
            setIsEditingScenario(null);
            setEditingScenarioData(null);
          }}
          width={800}
        >
          {editingScenarioData && (
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="场景名称">
                    <Input
                      value={editingScenarioData.scenario_name}
                      onChange={(e) => setEditingScenarioData({
                        ...editingScenarioData,
                        scenario_name: e.target.value
                      })}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="优先级">
                    <Select
                      value={editingScenarioData.priority}
                      onChange={(value) => setEditingScenarioData({
                        ...editingScenarioData,
                        priority: value
                      })}
                    >
                      <Option value="高">高</Option>
                      <Option value="中">中</Option>
                      <Option value="低">低</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="分类">
                    <Select
                      value={editingScenarioData.category}
                      onChange={(value) => setEditingScenarioData({
                        ...editingScenarioData,
                        category: value
                      })}
                    >
                      <Option value="功能测试">功能测试</Option>
                      <Option value="异常测试">异常测试</Option>
                      <Option value="边界测试">边界测试</Option>
                      <Option value="性能测试">性能测试</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="场景描述">
                <TextArea
                  rows={3}
                  value={editingScenarioData.description}
                  onChange={(e) => setEditingScenarioData({
                    ...editingScenarioData,
                    description: e.target.value
                  })}
                />
              </Form.Item>

              <Form.Item label="测试步骤">
                <TextArea
                  rows={4}
                  value={editingScenarioData.test_steps.join('\n')}
                  onChange={(e) => setEditingScenarioData({
                    ...editingScenarioData,
                    test_steps: e.target.value.split('\n').filter(step => step.trim())
                  })}
                  placeholder="每行一个测试步骤"
                />
              </Form.Item>

              <Form.Item label="预期结果">
                <TextArea
                  rows={3}
                  value={editingScenarioData.expected_results.join('\n')}
                  onChange={(e) => setEditingScenarioData({
                    ...editingScenarioData,
                    expected_results: e.target.value.split('\n').filter(result => result.trim())
                  })}
                  placeholder="每行一个预期结果"
                />
              </Form.Item>
            </Form>
          )}
        </Modal>
      </Card>
    </div>
  );
};

export default TestCaseCreation;
