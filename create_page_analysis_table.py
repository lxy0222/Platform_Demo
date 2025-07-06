#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create page analysis table migration script
"""
import asyncio
import sys
import os

# Add project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'backend'))

from backend.app.database.session import get_db_session
from sqlalchemy import text

async def create_page_analysis_table():
    """Create page analysis table"""
    try:
        async with get_db_session() as db:
            # Read and execute SQL file
            sql_file_path = 'backend/migrations/create_page_analysis_records_table.sql'

            if not os.path.exists(sql_file_path):
                print(f"SQL file not found: {sql_file_path}")
                return
            
            with open(sql_file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Split and execute SQL statements
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

            for statement in statements:
                if statement and not statement.startswith('--'):
                    try:
                        await db.execute(text(statement))
                        print(f'Success: {statement[:50]}...')
                    except Exception as e:
                        print(f'Failed: {statement[:50]}... - {e}')

            await db.commit()
            print('Page analysis table created successfully!')
            
    except Exception as e:
        print(f"Failed to create table: {e}")

if __name__ == "__main__":
    asyncio.run(create_page_analysis_table())
