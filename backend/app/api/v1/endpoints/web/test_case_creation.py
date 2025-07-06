"""
Web测试用例创建 - API端点
支持图片分析生成测试用例场景，用户可编辑后生成脚本
"""
from autogen_core import CancellationToken, MessageContext, ClosureContext
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
import asyncio
import logging
import uuid
import json
import base64
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

from app.core.agents import StreamResponseCollector
from app.core.messages import StreamMessage
from app.core.messages.web import WebTestCaseGenerationRequest
from app.core.types import AgentPlatform
from app.services.web.orchestrator_service import get_web_orchestrator


router = APIRouter()

# 设置日志记录器
logger = logging.getLogger(__name__)

# 会话存储
active_sessions: Dict[str, Dict[str, Any]] = {}

# 消息队列存储
message_queues: Dict[str, asyncio.Queue] = {}

# 会话超时（秒）
SESSION_TIMEOUT = 3600  # 1小时


async def cleanup_session(session_id: str, delay: int = SESSION_TIMEOUT):
    """在指定延迟后清理会话资源"""
    await asyncio.sleep(delay)
    if session_id in active_sessions:
        logger.info(f"清理过期会话: {session_id}")
        active_sessions.pop(session_id, None)
        message_queues.pop(session_id, None)


@router.post("/test-case-creation/analyze-image")
async def analyze_image_for_test_cases(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    test_description: str = Form(...),
    additional_context: Optional[str] = Form(None),
    generate_formats: str = Form("yaml"),
    save_to_database: bool = Form(True),
    script_name: Optional[str] = Form(None),
    script_description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    category: str = Form("UI测试"),
    priority: int = Form(1)
):
    """
    分析图片生成测试用例场景（图片可选）
    """
    try:
        # 生成会话ID
        session_id = str(uuid.uuid4())

        # 处理图片数据（如果有）
        image_data_uri = None
        if file:
            image_data = await file.read()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            image_data_uri = f"data:{file.content_type};base64,{image_base64}"
        
        # 解析生成格式
        formats_list = [fmt.strip() for fmt in generate_formats.split(',')]
        
        # 解析标签
        tags_list = []
        if tags:
            try:
                tags_list = json.loads(tags)
            except json.JSONDecodeError:
                tags_list = [tag.strip() for tag in tags.split(',')]
        
        # 创建分析请求
        analysis_request = WebTestCaseGenerationRequest(
            session_id=session_id,
            image_data=image_data_uri,  # 可能为None
            test_description=test_description,
            additional_context=additional_context,
            generate_formats=formats_list
        )
        
        # 创建消息队列
        message_queues[session_id] = asyncio.Queue()
        
        # 初始化会话状态
        active_sessions[session_id] = {
            "status": "analyzing",
            "start_time": datetime.now(),
            "analysis_request": analysis_request.model_dump(),
            "save_config": {
                "save_to_database": save_to_database,
                "script_name": script_name,
                "script_description": script_description,
                "tags": tags_list,
                "category": category,
                "priority": priority
            }
        }
        
        # 启动后台分析任务
        background_tasks.add_task(
            run_test_case_analysis,
            session_id,
            analysis_request
        )
        
        # 启动会话清理任务
        background_tasks.add_task(cleanup_session, session_id)
        
        # 返回SSE端点信息
        return JSONResponse({
            "status": "success",
            "session_id": session_id,
            "sse_endpoint": f"/api/v1/web/test-case-creation/stream/{session_id}",
            "message": "测试用例分析已启动",
            "has_image": bool(file)
        })

    except Exception as e:
        logger.error(f"分析启动失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析启动失败: {str(e)}")


@router.post("/test-case-creation/analyze-text")
async def analyze_text_for_test_cases(
    background_tasks: BackgroundTasks,
    test_description: str,
    additional_context: Optional[str] = None,
    generate_formats: str = "yaml",
    save_to_database: bool = True,
    script_name: Optional[str] = None,
    script_description: Optional[str] = None,
    tags: Optional[str] = None,
    category: str = "UI测试",
    priority: int = 1
):
    """
    基于文字描述生成测试用例场景
    """
    try:
        # 生成会话ID
        session_id = str(uuid.uuid4())

        # 解析生成格式
        formats_list = [fmt.strip() for fmt in generate_formats.split(',')]

        # 解析标签
        tags_list = []
        if tags:
            try:
                tags_list = json.loads(tags)
            except json.JSONDecodeError:
                tags_list = [tag.strip() for tag in tags.split(',')]

        # 创建分析请求（不包含图片）
        analysis_request = WebTestCaseGenerationRequest(
            session_id=session_id,
            test_description=test_description,
            additional_context=additional_context,
            generate_formats=formats_list
        )

        # 创建消息队列
        message_queues[session_id] = asyncio.Queue()

        # 初始化会话状态
        active_sessions[session_id] = {
            "status": "analyzing",
            "start_time": datetime.now(),
            "analysis_request": analysis_request.model_dump(),
            "save_config": {
                "save_to_database": save_to_database,
                "script_name": script_name,
                "script_description": script_description,
                "tags": tags_list,
                "category": category,
                "priority": priority
            }
        }

        # 启动后台分析任务
        background_tasks.add_task(
            run_test_case_analysis,
            session_id,
            analysis_request
        )

        # 启动会话清理任务
        background_tasks.add_task(cleanup_session, session_id)

        # 返回SSE端点信息
        return JSONResponse({
            "status": "success",
            "session_id": session_id,
            "sse_endpoint": f"/api/v1/web/test-case-creation/stream/{session_id}",
            "message": "文字分析已启动",
            "has_image": False
        })

    except Exception as e:
        logger.error(f"文字分析启动失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析启动失败: {str(e)}")


async def run_test_case_analysis(session_id: str, request: WebTestCaseGenerationRequest):
    """运行测试用例分析"""
    try:
        logger.info(f"开始测试用例分析，会话ID: {session_id}")

        # 设置消息回调函数
        async def message_callback(ctx: ClosureContext, message: StreamMessage, message_ctx: MessageContext) -> None:
            try:
                # 获取当前队列（确保使用最新的队列引用）
                current_queue = message_queues.get(session_id)
                if current_queue:
                    await current_queue.put(message)
                else:
                    logger.error(f"消息回调：会话 {session_id} 的队列不存在")

            except Exception as e:
                logger.error(f"消息回调处理错误: {str(e)}")

        # 创建响应收集器
        collector = StreamResponseCollector(platform=AgentPlatform.WEB)
        collector.set_callback(message_callback)

        # 获取Web编排器（传入collector）
        from app.services.web.orchestrator_service import get_web_orchestrator
        orchestrator = get_web_orchestrator(collector=collector)

        # 运行分析
        await orchestrator.run_test_case_analysis(
            request=request,
            platform="web"
        )
        
        # 更新会话状态
        if session_id in active_sessions:
            active_sessions[session_id].update({
                "status": "completed",
                "end_time": datetime.now()
            })
        
        # 发送完成消息
        if session_id in message_queues:
            await message_queues[session_id].put(StreamMessage(
                type="completion",
                source="test_case_analysis",
                content="分析流程已完成",
                is_final=True
            ))
        
        logger.info(f"测试用例分析完成，会话ID: {session_id}")
        
    except Exception as e:
        logger.error(f"测试用例分析失败，会话ID: {session_id}, 错误: {str(e)}")
        
        # 更新会话状态为失败
        if session_id in active_sessions:
            active_sessions[session_id].update({
                "status": "failed",
                "error": str(e),
                "end_time": datetime.now()
            })
        
        # 发送错误消息
        if session_id in message_queues:
            await message_queues[session_id].put(StreamMessage(
                type="error",
                source="test_case_analysis",
                content=f"分析失败: {str(e)}",
                is_final=True,
                error=str(e)
            ))


@router.get("/test-case-creation/stream/{session_id}")
async def stream_test_case_analysis(session_id: str):
    """
    SSE流式接口 - 实时获取测试用例分析进度
    """
    if session_id not in message_queues:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    async def event_generator():
        queue = message_queues[session_id]
        
        try:
            while True:
                try:
                    # 等待消息，设置超时
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    
                    # 构建SSE数据
                    data = {
                        "content": message.content,
                        "region": message.region,
                        "source": message.source,
                        "is_final": message.is_final,
                        "timestamp": message.timestamp.isoformat() if message.timestamp else None
                    }
                    
                    # 如果有结果数据，添加到响应中
                    if message.result:
                        data["result"] = message.result
                    
                    # 如果有错误，添加到响应中
                    if message.error:
                        data["error"] = message.error
                    
                    yield {
                        "event": "message",
                        "data": json.dumps(data, ensure_ascii=False)
                    }
                    
                    # 如果是最终消息，结束流
                    if message.is_final:
                        break
                        
                except asyncio.TimeoutError:
                    # 发送心跳消息
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({"timestamp": datetime.now().isoformat()})
                    }
                    
        except Exception as e:
            logger.error(f"SSE流错误，会话ID: {session_id}, 错误: {str(e)}")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
    
    return EventSourceResponse(event_generator())


@router.get("/test-case-creation/status/{session_id}")
async def get_test_case_analysis_status(session_id: str):
    """
    获取测试用例分析状态
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session_data = active_sessions[session_id]
    
    return JSONResponse({
        "status": "success",
        "session_id": session_id,
        "analysis_status": session_data.get("status"),
        "start_time": session_data.get("start_time").isoformat() if session_data.get("start_time") else None,
        "end_time": session_data.get("end_time").isoformat() if session_data.get("end_time") else None,
        "result": session_data.get("result"),
        "error": session_data.get("error")
    })


@router.post("/test-case-creation/generate-scripts")
async def generate_scripts_from_test_cases(
    background_tasks: BackgroundTasks,
    session_id: str,
    test_scenarios: List[Dict[str, Any]],
    generate_formats: List[str] = ["yaml", "playwright"]
):
    """
    根据选定的测试用例场景生成脚本
    """
    try:
        if session_id not in active_sessions:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 更新会话状态
        active_sessions[session_id].update({
            "status": "generating_scripts",
            "selected_scenarios": test_scenarios,
            "generate_formats": generate_formats
        })
        
        # 启动脚本生成任务
        background_tasks.add_task(
            run_script_generation,
            session_id,
            test_scenarios,
            generate_formats
        )
        
        return JSONResponse({
            "status": "success",
            "session_id": session_id,
            "message": "脚本生成已启动",
            "scenarios_count": len(test_scenarios)
        })
        
    except Exception as e:
        logger.error(f"脚本生成启动失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"脚本生成启动失败: {str(e)}")


async def run_script_generation(session_id: str, test_scenarios: List[Dict[str, Any]], generate_formats: List[str]):
    """运行脚本生成"""
    try:
        logger.info(f"开始脚本生成，会话ID: {session_id}")

        # 设置消息回调函数
        async def message_callback(ctx: ClosureContext, message: StreamMessage, message_ctx: MessageContext) -> None:
            try:
                # 获取当前队列（确保使用最新的队列引用）
                current_queue = message_queues.get(session_id)
                if current_queue:
                    await current_queue.put(message)
                else:
                    logger.error(f"消息回调：会话 {session_id} 的队列不存在")

            except Exception as e:
                logger.error(f"消息回调处理错误: {str(e)}")

        # 创建响应收集器
        collector = StreamResponseCollector(platform=AgentPlatform.WEB)
        collector.set_callback(message_callback)

        # 获取Web编排器（传入collector）
        from app.services.web.orchestrator_service import get_web_orchestrator
        orchestrator = get_web_orchestrator(collector=collector)

        # 运行脚本生成
        await orchestrator.run_script_generation_from_scenarios(
            session_id=session_id,
            test_scenarios=test_scenarios,
            generate_formats=generate_formats
        )
        
        # 更新会话状态
        if session_id in active_sessions:
            active_sessions[session_id].update({
                "status": "script_generation_completed",
                "script_end_time": datetime.now()
            })
        
        logger.info(f"脚本生成完成，会话ID: {session_id}")
        
    except Exception as e:
        logger.error(f"脚本生成失败，会话ID: {session_id}, 错误: {str(e)}")
        
        # 更新会话状态为失败
        if session_id in active_sessions:
            active_sessions[session_id].update({
                "status": "script_generation_failed",
                "script_error": str(e)
            })
