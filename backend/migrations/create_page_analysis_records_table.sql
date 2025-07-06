-- 创建页面分析记录表
CREATE TABLE IF NOT EXISTS page_analysis_records (
    id VARCHAR(36) PRIMARY KEY,
    
    -- 关联项目
    project_id VARCHAR(36),
    
    -- 基本信息
    page_name VARCHAR(255) NOT NULL COMMENT '页面名称',
    original_filename VARCHAR(255) NOT NULL COMMENT '原始文件名',
    image_path VARCHAR(500) NOT NULL COMMENT '图片存储路径',
    
    -- 分析状态
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '分析状态',
    
    -- 分析结果
    analysis_result JSON COMMENT '分析结果JSON',
    confidence_score DECIMAL(5,4) DEFAULT 0.0000 COMMENT '置信度分数',
    
    -- 页面信息
    page_title VARCHAR(255) COMMENT '页面标题',
    page_type VARCHAR(100) COMMENT '页面类型',
    main_content TEXT COMMENT '主要内容描述',
    
    -- UI元素信息
    ui_elements_count INTEGER DEFAULT 0 COMMENT '识别的UI元素数量',
    ui_elements JSON COMMENT 'UI元素详细信息',
    
    -- 处理信息
    processing_time DECIMAL(10,3) DEFAULT 0.000 COMMENT '处理时间(秒)',
    error_message TEXT COMMENT '错误信息',
    
    -- 文件信息
    file_size INTEGER COMMENT '文件大小(字节)',
    file_type VARCHAR(50) COMMENT '文件类型',
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_page_analysis_status ON page_analysis_records(status);
CREATE INDEX IF NOT EXISTS idx_page_analysis_created_at ON page_analysis_records(created_at);
CREATE INDEX IF NOT EXISTS idx_page_analysis_project_id ON page_analysis_records(project_id);
CREATE INDEX IF NOT EXISTS idx_page_analysis_page_name ON page_analysis_records(page_name);

-- 插入示例数据
INSERT INTO page_analysis_records (
    id, page_name, original_filename, image_path, status, 
    confidence_score, page_title, page_type, main_content,
    ui_elements_count, processing_time, file_size, file_type
) VALUES (
    'sample_page_001',
    '登录页面',
    'login_page.png',
    '/uploads/page_analysis/sample_login.png',
    'completed',
    0.9500,
    '用户登录',
    'login',
    '包含用户名输入框、密码输入框和登录按钮的标准登录页面',
    5,
    2.350,
    1024000,
    'image/png'
);

INSERT INTO page_analysis_records (
    id, page_name, original_filename, image_path, status,
    confidence_score, page_title, page_type, main_content,
    ui_elements_count, processing_time, file_size, file_type
) VALUES (
    'sample_page_002',
    '首页',
    'homepage.jpg',
    '/uploads/page_analysis/sample_homepage.jpg',
    'completed',
    0.8800,
    '网站首页',
    'homepage',
    '包含导航栏、轮播图、产品展示区域和页脚的首页布局',
    12,
    3.120,
    2048000,
    'image/jpeg'
);
