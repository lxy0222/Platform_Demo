"""
页面分析知识库服务
用于在创建测试时检索相关的页面元素分析结果
"""
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from loguru import logger

from app.database.connection import db_manager
from app.database.models.page_analysis import PageAnalysisResult


class PageAnalysisKnowledgeBase:
    """页面分析知识库"""
    
    def __init__(self):
        self.similarity_threshold = 0.3  # 相似度阈值
    
    async def search_similar_pages(
        self, 
        query: str, 
        page_type: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        搜索相似的页面分析结果
        
        Args:
            query: 搜索查询（页面名称、功能描述等）
            page_type: 页面类型过滤
            limit: 返回结果数量限制
            
        Returns:
            相似页面分析结果列表
        """
        try:
            async with db_manager.get_session() as session:
                # 构建查询
                stmt = select(PageAnalysisResult)
                
                # 添加搜索条件
                search_conditions = []
                
                if query:
                    # 在页面名称、描述中搜索
                    search_conditions.append(
                        or_(
                            PageAnalysisResult.page_name.ilike(f'%{query}%'),
                            PageAnalysisResult.page_description.ilike(f'%{query}%'),
                            PageAnalysisResult.analysis_summary.ilike(f'%{query}%')
                        )
                    )

                if page_type:
                    search_conditions.append(
                        PageAnalysisResult.page_type == page_type
                    )
                
                if search_conditions:
                    stmt = stmt.where(and_(*search_conditions))
                
                # 按置信度和创建时间排序
                stmt = stmt.order_by(
                    PageAnalysisResult.confidence_score.desc(),
                    PageAnalysisResult.created_at.desc()
                ).limit(limit)
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                # 转换为字典格式
                similar_pages = []
                for record in records:
                    page_data = {
                        "id": record.id,
                        "page_name": record.page_name,
                        "page_title": record.page_title,
                        "page_type": record.page_type,
                        "main_content": record.main_content,
                        "ui_elements": record.ui_elements or [],
                        "ui_elements_count": record.ui_elements_count,
                        "confidence_score": record.confidence_score,
                        "analysis_result": record.analysis_result or {},
                        "created_at": record.created_at.isoformat() if record.created_at else None
                    }
                    similar_pages.append(page_data)
                
                logger.info(f"找到 {len(similar_pages)} 个相似页面，查询: {query}")
                return similar_pages
                
        except Exception as e:
            logger.error(f"搜索相似页面失败: {str(e)}")
            return []
    
    async def get_ui_elements_by_type(
        self, 
        element_type: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        根据元素类型获取UI元素示例
        
        Args:
            element_type: 元素类型（button, input, link等）
            limit: 返回结果数量限制
            
        Returns:
            UI元素示例列表
        """
        try:
            async with db_manager.get_session() as session:
                # 查询包含指定元素类型的页面
                stmt = select(PageAnalysisRecord).where(
                    PageAnalysisRecord.status == 'completed',
                    PageAnalysisRecord.ui_elements.isnot(None)
                ).order_by(
                    PageAnalysisRecord.confidence_score.desc()
                ).limit(limit * 2)  # 多查询一些，然后过滤
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                # 提取指定类型的UI元素
                ui_elements = []
                for record in records:
                    if record.ui_elements:
                        for element in record.ui_elements:
                            if isinstance(element, dict) and element.get('type') == element_type:
                                element_data = {
                                    "page_id": record.id,
                                    "page_name": record.page_name,
                                    "page_type": record.page_type,
                                    "element": element
                                }
                                ui_elements.append(element_data)
                                
                                if len(ui_elements) >= limit:
                                    break
                    
                    if len(ui_elements) >= limit:
                        break
                
                logger.info(f"找到 {len(ui_elements)} 个 {element_type} 类型的UI元素")
                return ui_elements
                
        except Exception as e:
            logger.error(f"获取UI元素失败: {str(e)}")
            return []
    
    async def get_page_types_summary(self) -> Dict[str, Any]:
        """
        获取页面类型统计摘要
        
        Returns:
            页面类型统计信息
        """
        try:
            async with db_manager.get_session() as session:
                # 统计页面类型
                stmt = select(
                    PageAnalysisRecord.page_type,
                    func.count(PageAnalysisRecord.id).label('count')
                ).where(
                    PageAnalysisRecord.status == 'completed'
                ).group_by(
                    PageAnalysisRecord.page_type
                ).order_by(
                    func.count(PageAnalysisRecord.id).desc()
                )
                
                result = await session.execute(stmt)
                page_types = result.all()

                # 统计总数
                total_stmt = select(func.count(PageAnalysisRecord.id)).where(
                    PageAnalysisRecord.status == 'completed'
                )
                total_result = await session.execute(total_stmt)
                total_count = total_result.scalar()
                
                summary = {
                    "total_pages": total_count,
                    "page_types": [
                        {"type": pt.page_type, "count": pt.count}
                        for pt in page_types
                    ]
                }
                
                logger.info(f"页面类型统计: 总计 {total_count} 个页面，{len(page_types)} 种类型")
                return summary
                
        except Exception as e:
            logger.error(f"获取页面类型统计失败: {str(e)}")
            return {"total_pages": 0, "page_types": []}
    
    async def search_by_keywords(
        self, 
        keywords: List[str],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        根据关键词搜索页面
        
        Args:
            keywords: 关键词列表
            limit: 返回结果数量限制
            
        Returns:
            匹配的页面列表
        """
        try:
            if not keywords:
                return []
            
            async with db_manager.get_session() as session:
                # 构建关键词搜索条件
                search_conditions = []
                for keyword in keywords:
                    search_conditions.append(
                        or_(
                            PageAnalysisResult.page_name.ilike(f'%{keyword}%'),
                            PageAnalysisResult.page_description.ilike(f'%{keyword}%'),
                            PageAnalysisResult.analysis_summary.ilike(f'%{keyword}%')
                        )
                    )

                stmt = select(PageAnalysisResult).where(
                    or_(*search_conditions)
                ).order_by(
                    PageAnalysisResult.confidence_score.desc(),
                    PageAnalysisResult.created_at.desc()
                ).limit(limit)
                
                result = await session.execute(stmt)
                records = result.scalars().all()
                
                # 转换为字典格式
                matched_pages = []
                for record in records:
                    page_data = {
                        "id": record.id,
                        "page_name": record.page_name,
                        "page_title": record.page_title,
                        "page_type": record.page_type,
                        "main_content": record.main_content,
                        "ui_elements": record.ui_elements or [],
                        "confidence_score": record.confidence_score,
                        "matched_keywords": [
                            kw for kw in keywords 
                            if kw.lower() in (record.page_name or '').lower() or
                               kw.lower() in (record.page_title or '').lower() or
                               kw.lower() in (record.main_content or '').lower()
                        ]
                    }
                    matched_pages.append(page_data)
                
                logger.info(f"关键词搜索找到 {len(matched_pages)} 个页面，关键词: {keywords}")
                return matched_pages
                
        except Exception as e:
            logger.error(f"关键词搜索失败: {str(e)}")
            return []


# 全局知识库实例
page_analysis_kb = PageAnalysisKnowledgeBase()
