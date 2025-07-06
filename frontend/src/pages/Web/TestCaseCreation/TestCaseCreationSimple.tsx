import React, { useState, useCallback } from 'react';
import {
  Card,
  Upload,
  Input,
  Button,
  Form,
  Row,
  Col,
  Checkbox,
  message,
  Alert
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import './TestCaseCreation.css';

const { TextArea } = Input;

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

const TestCaseCreationSimple: React.FC = () => {
  const [form] = Form.useForm();
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['playwright']);
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 处理图片上传 - 立即分析
  const handleImageUpload = useCallback(async (file: any) => {
    setUploadedFile(file);
    
    // 模拟图片分析
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const mockScenarios = [
        {
          scenario_id: 'TC001',
          scenario_name: '登录功能测试',
          description: '验证用户登录功能',
          category: '功能测试',
          priority: '高',
          estimated_duration: '2分钟',
          preconditions: [],
          test_steps: ['输入用户名', '输入密码', '点击登录'],
          expected_results: ['成功登录'],
          test_data: {},
          tags: ['登录']
        }
      ];
      
      const scenarioTexts = mockScenarios.map(scenario => 
        `${scenario.scenario_name}: ${scenario.description}`
      ).join('\n');
      
      form.setFieldsValue({
        test_description: scenarioTexts
      });
      
      setTestScenarios(mockScenarios);
      setIsAnalyzing(false);
      toast.success('图片分析完成，已填入测试场景');
    }, 2000);
    
    return false; // 阻止自动上传
  }, [form]);

  // 解析文字描述为测试场景
  const parseTextToScenarios = useCallback((text: string): TestScenario[] => {
    const scenarios: TestScenario[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes(':')) {
        const [name, description] = trimmedLine.split(':').map(s => s.trim());
        scenarios.push({
          scenario_id: `TC${index + 1}`,
          scenario_name: name,
          description: description,
          category: '功能测试',
          priority: '中',
          estimated_duration: '2分钟',
          preconditions: [],
          test_steps: [description],
          expected_results: ['功能正常工作'],
          test_data: {},
          tags: ['用户输入']
        });
      }
    });
    
    return scenarios;
  }, []);

  // 处理文字描述生成测试场景
  const handleTextAnalysis = useCallback(async (values: any) => {
    if (!values.test_description || values.test_description.trim() === '') {
      message.error('请输入测试描述');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 解析文字描述
      const scenarios = parseTextToScenarios(values.test_description.trim());
      
      if (scenarios.length > 0) {
        setTestScenarios(scenarios);
        toast.success(`已解析出 ${scenarios.length} 个测试场景`);
      } else {
        // 创建默认场景
        const defaultScenario: TestScenario = {
          scenario_id: `TC${Date.now()}`,
          scenario_name: '基于描述的测试场景',
          description: values.test_description.trim(),
          category: '功能测试',
          priority: '中',
          estimated_duration: '2分钟',
          preconditions: [],
          test_steps: values.test_description.split('\n').filter((step: string) => step.trim()),
          expected_results: ['功能正常工作'],
          test_data: {},
          tags: ['用户输入']
        };
        setTestScenarios([defaultScenario]);
        toast.success('已创建基于描述的测试场景');
      }
    } catch (error: any) {
      toast.error(`分析失败: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [parseTextToScenarios]);

  return (
    <div className="test-case-creation">
      <Card title="测试用例创建（简化版）">
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
                  disabled={isAnalyzing}
                >
                  <Button 
                    icon={<UploadOutlined />}
                    loading={isAnalyzing}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '分析中...' : uploadedFile ? uploadedFile.name : '选择图片自动分析'}
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
注册功能测试: 验证新用户注册流程`}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isAnalyzing}
              icon={<CheckCircleOutlined />}
              size="large"
            >
              解析测试场景
            </Button>
          </Form.Item>
        </Form>

        {testScenarios.length > 0 && (
          <Card title="解析出的测试场景" style={{ marginTop: 16 }}>
            {testScenarios.map((scenario, index) => (
              <div key={scenario.scenario_id} style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
                <h4>{scenario.scenario_name}</h4>
                <p>{scenario.description}</p>
                <div>
                  <strong>分类:</strong> {scenario.category} | 
                  <strong> 优先级:</strong> {scenario.priority} | 
                  <strong> 预计时长:</strong> {scenario.estimated_duration}
                </div>
              </div>
            ))}
          </Card>
        )}
      </Card>
    </div>
  );
};

export default TestCaseCreationSimple;
