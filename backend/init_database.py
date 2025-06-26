#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库初始化脚本
用于创建PostgreSQL数据库表结构
"""
import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def init_database():
    """初始化数据库表结构"""
    print("🐘 PostgreSQL数据库初始化")
    print("=" * 50)
    
    try:
        # 导入配置
        from app.core.config import get_settings
        settings = get_settings()
        
        print(f"📋 数据库URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
        
        # 检查是否为PostgreSQL
        if 'postgresql' not in settings.database_url:
            print("⚠️  警告: 当前配置不是PostgreSQL数据库")
            print(f"   当前URL: {settings.database_url}")
            return False
        
        # 导入数据库管理器
        from app.database.connection import db_manager
        
        print("🚀 初始化数据库连接...")
        await db_manager.initialize()
        
        # 测试连接
        print("🔗 测试数据库连接...")
        async with db_manager.get_session() as session:
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1"))
            if result.scalar() == 1:
                print("✅ 数据库连接成功")
            else:
                print("❌ 数据库连接失败")
                return False
        
        # 创建所有表
        print("🏗️  创建数据库表...")
        await db_manager.create_tables()
        print("✅ 数据库表创建成功")
        
        # 验证表是否创建成功
        print("🔍 验证表结构...")
        async with db_manager.get_session() as session:
            # 查询所有表
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"✅ 成功创建 {len(tables)} 个表:")
                for table in tables:
                    print(f"   - {table}")
            else:
                print("⚠️  没有找到任何表")
                return False
        
        # 关闭连接
        await db_manager.close()
        print("\n🎉 数据库初始化完成!")
        return True
        
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        print("\n🔧 可能的解决方案:")
        print("   1. 确保PostgreSQL服务正在运行")
        print("   2. 检查.env文件中的数据库配置")
        print("   3. 确保数据库存在且用户有足够权限")
        print("   4. 检查网络连接")
        return False

async def check_database_status():
    """检查数据库状态"""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        
        print("📊 数据库状态检查")
        print("-" * 30)
        
        # 导入数据库管理器
        from app.database.connection import db_manager
        await db_manager.initialize()
        
        async with db_manager.get_session() as session:
            from sqlalchemy import text
            
            # 获取PostgreSQL版本
            version_result = await session.execute(text("SELECT version()"))
            version = version_result.scalar()
            print(f"PostgreSQL版本: {version.split(',')[0]}")
            
            # 获取当前数据库信息
            db_result = await session.execute(text("SELECT current_database(), current_user"))
            db_info = db_result.fetchone()
            print(f"当前数据库: {db_info[0]}")
            print(f"当前用户: {db_info[1]}")
            
            # 检查表数量
            table_result = await session.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            table_count = table_result.scalar()
            print(f"表数量: {table_count}")
            
            # 如果有表，显示表信息
            if table_count > 0:
                tables_result = await session.execute(text("""
                    SELECT table_name, 
                           (SELECT COUNT(*) FROM information_schema.columns 
                            WHERE table_name = t.table_name AND table_schema = 'public') as column_count
                    FROM information_schema.tables t
                    WHERE table_schema = 'public' 
                    ORDER BY table_name
                """))
                
                print("\n表详情:")
                for table_name, column_count in tables_result.fetchall():
                    print(f"  - {table_name} ({column_count} 列)")
        
        await db_manager.close()
        return True
        
    except Exception as e:
        print(f"❌ 状态检查失败: {e}")
        return False

async def create_database_if_not_exists():
    """如果数据库不存在则创建"""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        
        # 解析数据库URL
        import re
        pattern = r'postgresql\+asyncpg://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)'
        match = re.match(pattern, settings.database_url)
        
        if not match:
            print("❌ 无法解析数据库URL")
            return False
        
        user, password, host, port, database = match.groups()
        
        print(f"🔍 检查数据库 '{database}' 是否存在...")
        
        # 连接到postgres默认数据库
        import asyncpg
        default_url = f'postgresql://{user}:{password}@{host}:{port}/postgres'
        
        try:
            conn = await asyncpg.connect(default_url)
            
            # 检查数据库是否存在
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", database
            )
            
            if not exists:
                print(f"📦 创建数据库 '{database}'...")
                await conn.execute(f'CREATE DATABASE "{database}"')
                print(f"✅ 数据库 '{database}' 创建成功")
            else:
                print(f"✅ 数据库 '{database}' 已存在")
            
            await conn.close()
            return True
            
        except Exception as e:
            print(f"❌ 数据库操作失败: {e}")
            return False
        
    except Exception as e:
        print(f"❌ 数据库创建失败: {e}")
        return False

if __name__ == "__main__":
    print("🐘 PostgreSQL数据库初始化工具")
    print("=" * 60)
    
    async def main():
        # 第一步：检查/创建数据库
        print("步骤 1: 检查/创建数据库")
        db_created = await create_database_if_not_exists()
        
        if not db_created:
            print("❌ 数据库创建失败，退出")
            sys.exit(1)
        
        # 第二步：初始化表结构
        print("\n步骤 2: 初始化表结构")
        init_success = await init_database()
        
        if not init_success:
            print("❌ 表结构初始化失败，退出")
            sys.exit(1)
        
        # 第三步：检查状态
        print("\n步骤 3: 检查数据库状态")
        await check_database_status()
        
        print("\n🎉 数据库初始化完成! 现在可以启动应用了")
    
    asyncio.run(main())
