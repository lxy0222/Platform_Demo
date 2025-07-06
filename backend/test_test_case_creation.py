#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试用例创建功能测试脚本
验证新的测试用例创建API和智能体是否正常工作
"""
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.core.types import AgentTypes
    from app.core.messages.web import WebTestCaseGenerationRequest
    print("✅ 成功导入核心模块")
except ImportError as e:
    print("❌ 导入核心模块失败: " + str(e))
    sys.exit(1)


def test_agent_types():
    """测试智能体类型定义"""
    print("🧪 测试智能体类型定义...")

    try:
        # 检查TEST_CASE_GENERATOR是否存在
        assert hasattr(AgentTypes, 'TEST_CASE_GENERATOR')
        assert AgentTypes.TEST_CASE_GENERATOR.value == "test_case_generator"

        print("✅ TEST_CASE_GENERATOR 智能体类型定义正确")
        return True

    except Exception as e:
        print("❌ 智能体类型测试失败: " + str(e))
        return False


def test_message_types():
    """测试消息类型"""
    print("🧪 测试消息类型...")
    
    try:
        # 测试WebTestCaseGenerationRequest
        request = WebTestCaseGenerationRequest(
            session_id="test-123",
            image_data="data:image/png;base64,test",
            test_description="测试描述",
            generate_formats=["yaml"]
        )
        
        # 验证序列化
        request_dict = request.model_dump()
        assert "session_id" in request_dict
        assert "test_description" in request_dict
        assert "generate_formats" in request_dict
        
        # 验证反序列化
        request_from_dict = WebTestCaseGenerationRequest(**request_dict)
        assert request_from_dict.session_id == request.session_id
        
        print("✅ 消息类型测试通过")
        return True
        
    except Exception as e:
        print("❌ 消息类型测试失败: " + str(e))
        return False


def main():
    """主测试函数"""
    print("🚀 开始测试用例创建功能测试")
    print("=" * 50)

    test_results = []

    # 运行所有测试
    tests = [
        ("智能体类型测试", test_agent_types),
        ("消息类型测试", test_message_types),
    ]

    for test_name, test_func in tests:
        print("\n📋 运行: " + test_name)
        print("-" * 30)

        result = test_func()
        test_results.append((test_name, result))

        if result:
            print("✅ " + test_name + " 通过")
        else:
            print("❌ " + test_name + " 失败")

    # 汇总结果
    print("\n" + "=" * 50)
    print("📊 测试结果汇总:")

    passed = 0
    total = len(test_results)

    for test_name, result in test_results:
        status = "✅ 通过" if result else "❌ 失败"
        print("   " + test_name + ": " + status)
        if result:
            passed += 1

    print("\n🎯 总体结果: " + str(passed) + "/" + str(total) + " 个测试通过")

    if passed == total:
        print("🎉 所有测试通过！测试用例创建功能基本正常")
        return True
    else:
        print("⚠️ 部分测试失败，请检查相关功能")
        return False


if __name__ == "__main__":
    # 运行测试
    result = main()

    # 退出码
    exit(0 if result else 1)
