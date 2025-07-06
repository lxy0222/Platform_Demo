"""
测试用例生成智能体
基于图片分析结果生成可能的测试用例场景，供用户选择和编辑
"""
import json
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime

from autogen_agentchat.base import TaskResult
from autogen_agentchat.messages import ModelClientStreamingChunkEvent, TextMessage
from autogen_core import message_handler, type_subscription, MessageContext, TopicId
from autogen_agentchat.agents import AssistantAgent
from loguru import logger

from app.core.messages.web import WebMultimodalAnalysisResponse, WebTestCaseGenerationRequest
from app.core.agents.base import BaseAgent
from app.core.types import TopicTypes, AgentTypes, AGENT_NAMES, MessageRegion, LLModel


@type_subscription(topic_type=TopicTypes.TEST_CASE_GENERATOR.value)
class TestCaseGeneratorAgent(BaseAgent):
    """测试用例生成智能体，基于图片分析结果生成测试用例场景"""

    def __init__(self, model_client_instance=None, **kwargs):
        """初始化测试用例生成智能体"""
        super().__init__(
            agent_id=AgentTypes.TEST_CASE_GENERATOR.value,
            agent_name=AGENT_NAMES[AgentTypes.TEST_CASE_GENERATOR.value],
            model_client_instance=model_client_instance,
            **kwargs
        )

        self.metrics = None
        logger.info("测试用例生成智能体初始化完成")

    @classmethod
    def create_assistant_agent(cls, model_client_instance=None, **kwargs) -> AssistantAgent:
        """创建用于测试用例生成的AssistantAgent实例"""
        from app.agents.factory import agent_factory

        return agent_factory.create_assistant_agent(
            name="test_case_generator",
            system_message=cls._build_prompt_template_static(),
            model_client_type=LLModel.DEEPSEEK,
            model_client_stream=True,
            **kwargs
        )

    @staticmethod
    def _build_prompt_template_static() -> str:
        """构建静态的测试用例生成提示模板"""
        return """你是测试用例生成专家，专门根据UI界面分析结果生成可能的测试用例场景。

## 核心职责

### 1. 测试场景识别
- **功能测试场景**: 基于界面元素识别主要功能测试点
- **交互测试场景**: 分析用户可能的交互路径
- **边界测试场景**: 识别异常情况和边界条件
- **用户体验场景**: 关注用户操作流程的完整性

### 2. 测试用例设计原则
- **场景驱动**: 基于真实用户使用场景
- **覆盖全面**: 包含正常流程、异常流程、边界情况
- **可执行性**: 每个测试用例都应该可以自动化执行
- **优先级明确**: 根据业务重要性设置优先级

### 3. 输出格式要求

请严格按照以下JSON格式输出测试用例场景：

```json
{
  "suggested_test_scenarios": [
    {
      "scenario_id": "TC001",
      "scenario_name": "用户登录功能测试",
      "description": "验证用户通过用户名密码登录系统的完整流程",
      "category": "功能测试",
      "priority": "高",
      "estimated_duration": "2分钟",
      "preconditions": [
        "用户已注册账号",
        "页面已正常加载"
      ],
      "test_steps": [
        "点击登录按钮",
        "输入有效用户名",
        "输入正确密码",
        "点击提交按钮",
        "验证登录成功"
      ],
      "expected_results": [
        "成功跳转到主页面",
        "显示用户信息",
        "登录状态正确"
      ],
      "test_data": {
        "username": "test@example.com",
        "password": "password123"
      },
      "tags": ["登录", "认证", "基础功能"]
    },
    {
      "scenario_id": "TC002", 
      "scenario_name": "登录失败处理",
      "description": "验证输入错误凭据时的错误处理",
      "category": "异常测试",
      "priority": "中",
      "estimated_duration": "1分钟",
      "preconditions": [
        "页面已正常加载"
      ],
      "test_steps": [
        "点击登录按钮",
        "输入无效用户名",
        "输入错误密码", 
        "点击提交按钮",
        "验证错误提示"
      ],
      "expected_results": [
        "显示错误提示信息",
        "不允许登录",
        "保持在登录页面"
      ],
      "test_data": {
        "username": "invalid@example.com",
        "password": "wrongpassword"
      },
      "tags": ["登录", "错误处理", "异常流程"]
    }
  ],
  "analysis_summary": {
    "total_scenarios": 2,
    "high_priority": 1,
    "medium_priority": 1,
    "low_priority": 0,
    "categories": ["功能测试", "异常测试"],
    "estimated_total_time": "3分钟"
  }
}
```

## 设计原则

### 1. 基于界面元素分析
- 识别所有可交互元素（按钮、输入框、链接等）
- 分析元素之间的逻辑关系
- 推断可能的用户操作流程

### 2. 场景分类策略
- **正常流程**: 用户按预期路径操作
- **异常流程**: 错误输入、网络异常等
- **边界测试**: 最大值、最小值、空值等
- **兼容性测试**: 不同浏览器、设备等

### 3. 优先级设置
- **高优先级**: 核心业务功能、主要用户路径
- **中优先级**: 辅助功能、常见异常处理
- **低优先级**: 边界情况、罕见场景

### 4. 测试数据设计
- 提供具体的测试数据示例
- 包含有效数据和无效数据
- 考虑数据的多样性和代表性

## 输出要求

1. **场景完整性**: 每个场景包含完整的测试信息
2. **可执行性**: 测试步骤清晰，可直接转换为自动化脚本
3. **实用性**: 基于真实用户需求，避免过于理论化
4. **多样性**: 覆盖不同类型的测试场景
5. **结构化**: 严格遵循JSON格式，便于程序处理

请根据提供的UI界面分析结果，生成3-8个不同类型的测试用例场景。
"""

    @message_handler
    async def handle_message(self, message: WebTestCaseGenerationRequest, ctx: MessageContext) -> None:
        """处理测试用例生成请求"""
        try:
            monitor_id = self.start_performance_monitoring()
            
            await self.send_response("🎯 开始生成测试用例场景...\n\n")
            
            # 创建测试用例生成智能体
            test_case_agent = self.create_assistant_agent()
            
            # 准备分析内容
            analysis_content = self._prepare_analysis_content(message)
            
            # 生成测试用例
            test_cases = await self._generate_test_cases(test_case_agent, analysis_content)
            
            self.metrics = self.end_performance_monitoring(monitor_id)
            
            await self.send_response(
                "✅ 测试用例生成完成",
                is_final=True,
                result={
                    "test_cases": test_cases,
                    "generation_complete": True,
                    "metrics": self.metrics
                }
            )

        except Exception as e:
            await self.handle_exception("handle_message", e)

    def _prepare_analysis_content(self, message: WebTestCaseGenerationRequest) -> str:
        """准备分析内容"""
        try:
            if message.image_data:
                # 有图片的情况
                content = f"""
请基于以下UI界面图片生成测试用例场景：

**测试需求描述**: {message.test_description}
**附加上下文**: {message.additional_context or '无'}
**生成格式**: {', '.join(message.generate_formats)}

请分析提供的界面图片，识别其中的UI元素和可能的用户操作流程，然后生成3-8个不同类型的测试用例场景，包括：
1. 功能测试场景 - 验证主要功能是否正常工作
2. 异常测试场景 - 验证错误处理和异常情况
3. 边界测试场景 - 验证边界条件和极限情况
4. 用户体验场景 - 验证用户操作流程的完整性

每个测试场景应该包含：
- 场景名称和描述
- 测试步骤
- 预期结果
- 测试数据（如需要）
- 优先级和分类

请根据界面的实际内容生成具体、可执行的测试用例场景。
"""
            else:
                # 没有图片，基于文字描述
                content = f"""
请基于以下文字描述生成测试用例场景：

**测试需求描述**: {message.test_description}
**附加上下文**: {message.additional_context or '无'}
**生成格式**: {', '.join(message.generate_formats)}

请根据提供的文字描述，分析其中的功能需求和测试要点，然后生成3-8个不同类型的测试用例场景，包括：
1. 功能测试场景 - 验证主要功能是否正常工作
2. 异常测试场景 - 验证错误处理和异常情况
3. 边界测试场景 - 验证边界条件和极限情况
4. 集成测试场景 - 验证功能间的协作

每个测试场景应该包含：
- 场景名称和描述
- 测试步骤
- 预期结果
- 测试数据（如需要）
- 优先级和分类

请根据描述的功能需求生成具体、可执行的测试用例场景。
"""
            return content
            
        except Exception as e:
            logger.error(f"准备分析内容失败: {str(e)}")
            return "请生成基础的UI测试用例场景。"

    async def _generate_test_cases(self, agent: AssistantAgent, content: str) -> Dict[str, Any]:
        """生成测试用例"""
        try:
            await self.send_response("🔄 正在分析界面元素...\n\n")
            
            # 运行智能体生成测试用例
            stream = agent.run_stream(task=content)
            
            generated_content = ""
            async for event in stream:
                if isinstance(event, ModelClientStreamingChunkEvent):
                    await self.send_response(
                        content=event.content, 
                        region=MessageRegion.GENERATION, 
                        source="测试用例生成智能体"
                    )
                    generated_content += event.content
                elif isinstance(event, TaskResult):
                    if event.messages:
                        for msg in event.messages:
                            if isinstance(msg, TextMessage) and msg.source != "user":
                                generated_content += msg.content

            # 解析生成的测试用例
            test_cases = self._parse_generated_test_cases(generated_content)
            
            await self.send_response("✅ 测试用例场景生成完成\n\n")
            
            return test_cases

        except Exception as e:
            logger.error(f"生成测试用例失败: {str(e)}")
            return self._get_default_test_cases()

    def _parse_generated_test_cases(self, content: str) -> Dict[str, Any]:
        """解析生成的测试用例内容"""
        try:
            # 尝试提取JSON内容
            import re
            json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
            json_matches = re.findall(json_pattern, content, re.DOTALL)
            
            for json_str in json_matches:
                try:
                    parsed = json.loads(json_str)
                    if "suggested_test_scenarios" in parsed:
                        return parsed
                except json.JSONDecodeError:
                    continue
            
            # 如果没有找到有效的JSON，返回默认测试用例
            return self._get_default_test_cases()
            
        except Exception as e:
            logger.error(f"解析测试用例失败: {str(e)}")
            return self._get_default_test_cases()

    def _get_default_test_cases(self) -> Dict[str, Any]:
        """获取默认测试用例"""
        return {
            "suggested_test_scenarios": [
                {
                    "scenario_id": "TC001",
                    "scenario_name": "基础界面功能测试",
                    "description": "验证页面基础功能是否正常",
                    "category": "功能测试",
                    "priority": "高",
                    "estimated_duration": "2分钟",
                    "preconditions": ["页面已正常加载"],
                    "test_steps": [
                        "验证页面加载完成",
                        "检查主要元素显示",
                        "测试基本交互功能"
                    ],
                    "expected_results": [
                        "页面正常显示",
                        "元素可正常交互"
                    ],
                    "test_data": {},
                    "tags": ["基础功能", "UI测试"]
                }
            ],
            "analysis_summary": {
                "total_scenarios": 1,
                "high_priority": 1,
                "medium_priority": 0,
                "low_priority": 0,
                "categories": ["功能测试"],
                "estimated_total_time": "2分钟"
            }
        }
