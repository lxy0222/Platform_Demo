-- 添加分析状态字段到页面分析结果表
-- 迁移时间: 2025-01-05

-- 添加 analysis_status 字段
ALTER TABLE page_analysis_results 
ADD COLUMN analysis_status VARCHAR(20) DEFAULT 'pending';

-- 更新现有记录的状态为已完成（因为它们已经存在说明分析已完成）
UPDATE page_analysis_results 
SET analysis_status = 'completed' 
WHERE analysis_status = 'pending';

-- 添加索引以提高查询性能
CREATE INDEX idx_page_analysis_results_status ON page_analysis_results(analysis_status);

-- 添加检查约束确保状态值有效
ALTER TABLE page_analysis_results 
ADD CONSTRAINT chk_analysis_status 
CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed'));
