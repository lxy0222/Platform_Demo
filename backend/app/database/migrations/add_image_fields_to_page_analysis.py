"""
添加图片字段到页面分析结果表
"""
import asyncio
import logging
from sqlalchemy import text
from app.database.connection import db_manager

logger = logging.getLogger(__name__)

async def add_image_fields():
    """添加图片相关字段到page_analysis_results表"""
    try:
        async with db_manager.get_session() as session:
            # 检查字段是否已存在
            check_image_path = await session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'page_analysis_results' 
                AND column_name = 'image_path'
            """))
            
            if not check_image_path.fetchone():
                # 添加image_path字段
                await session.execute(text("""
                    ALTER TABLE page_analysis_results 
                    ADD COLUMN image_path VARCHAR(500)
                """))
                logger.info("已添加image_path字段")
            
            check_image_filename = await session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'page_analysis_results' 
                AND column_name = 'image_filename'
            """))
            
            if not check_image_filename.fetchone():
                # 添加image_filename字段
                await session.execute(text("""
                    ALTER TABLE page_analysis_results 
                    ADD COLUMN image_filename VARCHAR(255)
                """))
                logger.info("已添加image_filename字段")
            
            await session.commit()
            logger.info("页面分析结果表图片字段迁移完成")
            
    except Exception as e:
        logger.error(f"添加图片字段失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(add_image_fields())
