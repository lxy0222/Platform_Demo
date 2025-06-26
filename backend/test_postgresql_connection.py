#!/usr/bin/env python3
"""
PostgreSQL数据库连接测试脚本
用于验证PostgreSQL配置是否正确
"""
import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_postgresql_connection():
    """测试PostgreSQL数据库连接"""
    print("🔍 PostgreSQL数据库连接测试")
    print("=" * 50)
    
    try:
        # 导入配置
        from app.core.config import get_settings
        settings = get_settings()
        
        print(f"📋 使用数据库URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
        
        # 检查是否为PostgreSQL连接
        if 'postgresql' not in settings.database_url:
            print("⚠️  警告: 当前配置不是PostgreSQL数据库")
            print(f"   当前URL: {settings.database_url}")
            return False
        
        # 导入数据库管理器
        from app.database.connection import db_manager
        
        # 初始化数据库连接
        print("🚀 初始化PostgreSQL连接...")
        await db_manager.initialize()
        
        # 测试连接
        print("🔗 测试数据库连接...")
        async with db_manager.get_session() as session:
            from sqlalchemy import text
            
            # 测试基本查询
            result = await session.execute(text("SELECT 1 as test, NOW() as current_time"))
            row = result.fetchone()
            
            if row:
                print(f"✅ PostgreSQL连接成功!")
                print(f"   测试查询结果: {row.test}")
                print(f"   数据库时间: {row.current_time}")
            else:
                print("❌ PostgreSQL连接失败: 无法获取查询结果")
                return False
            
            # 测试PostgreSQL特有功能
            print("\n🔍 测试PostgreSQL特有功能...")
            
            # 获取PostgreSQL版本
            version_result = await session.execute(text("SELECT version()"))
            version = version_result.scalar()
            print(f"   PostgreSQL版本: {version}")
            
            # 获取当前数据库名
            db_result = await session.execute(text("SELECT current_database()"))
            current_db = db_result.scalar()
            print(f"   当前数据库: {current_db}")
            
            # 获取当前用户
            user_result = await session.execute(text("SELECT current_user"))
            current_user = user_result.scalar()
            print(f"   当前用户: {current_user}")
        
        # 测试表创建
        print("\n🏗️  测试表创建...")
        await db_manager.create_tables()
        print("✅ 数据库表创建成功")
        
        # 关闭连接
        await db_manager.close()
        print("\n🎉 PostgreSQL数据库测试完成!")
        return True
        
    except ImportError as e:
        print(f"❌ 导入错误: {e}")
        print("   请确保已安装所需依赖: pip install asyncpg")
        return False
    except Exception as e:
        print(f"❌ PostgreSQL连接测试失败: {e}")
        print("\n🔧 可能的解决方案:")
        print("   1. 确保PostgreSQL服务正在运行")
        print("   2. 检查.env文件中的数据库配置")
        print("   3. 确保数据库用户有足够权限")
        print("   4. 检查防火墙设置")
        return False

async def create_database_if_not_exists():
    """如果数据库不存在则创建"""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        
        # 解析数据库URL获取连接信息
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
        print(f"❌ 数据库创建失败: {e}")
        return False

if __name__ == "__main__":
    print("🐘 PostgreSQL数据库配置测试工具")
    print("=" * 60)
    
    async def main():
        # 首先尝试创建数据库
        print("第一步: 检查/创建数据库")
        await create_database_if_not_exists()
        
        print("\n第二步: 测试数据库连接")
        success = await test_postgresql_connection()
        
        if success:
            print("\n🎉 所有测试通过! PostgreSQL配置正确")
            sys.exit(0)
        else:
            print("\n❌ 测试失败，请检查配置")
            sys.exit(1)
    
    asyncio.run(main())
