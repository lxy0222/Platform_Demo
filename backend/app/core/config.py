"""
应用配置管理模块

提供统一的配置管理，支持环境变量和配置文件
"""
import os
from typing import Optional, List, Dict
try:
    from pydantic_settings import BaseSettings
    from pydantic import validator
except ImportError:
    from pydantic import BaseSettings, validator
from functools import lru_cache


class ApplicationSettings(BaseSettings):
    """应用基础配置"""

    # 应用信息
    APP_NAME: str = "智能自动化测试系统"
    APP_VERSION: str = "2.0.0"
    APP_DESCRIPTION: str = "基于多模态大模型与多智能体协作的自动化测试系统"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True

    # 安全配置
    SECRET_KEY: str = "your-secret-key-here-please-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    ALGORITHM: str = "HS256"

    # CORS配置
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        """获取CORS源列表"""
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]
        return self.BACKEND_CORS_ORIGINS

class ProjectSettings(BaseSettings):
    """项目基础配置"""

    # 项目信息 - 使用当前项目的tests目录
    @property
    def UI_UIAUTOMATION_DIR(self) -> str:
        """获取UI自动化测试目录路径"""
        import os
        from pathlib import Path

        # 获取当前文件的路径，然后向上查找项目根目录
        current_file = Path(__file__)  # backend/app/core/config.py

        # 从当前文件向上查找，直到找到包含backend目录的项目根目录
        project_root = current_file.parent.parent.parent.parent  # 向上4级: core -> app -> backend -> 项目根目录

        # 确保找到的是正确的项目根目录（应该包含backend和tests目录）
        if not (project_root / "backend").exists() or not (project_root / "tests").exists():
            # 如果没找到，尝试其他方法
            current_dir = Path(os.getcwd())
            while current_dir.parent != current_dir:  # 避免无限循环
                if (current_dir / "backend").exists() and (current_dir / "tests").exists():
                    project_root = current_dir
                    break
                current_dir = current_dir.parent
            else:
                # 最后的备选方案：使用固定路径
                project_root = Path("/Users/fairy/Desktop/Project/Platform_Demo")

        # 返回项目根目录下的tests目录
        return str(project_root / "tests")


class DatabaseSettings(BaseSettings):
    """数据库配置"""

    # 主数据库URL（优先使用）
    DATABASE_URL: Optional[str] = None

    # MySQL数据库配置（作为备选）
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 5432
    MYSQL_USER: str = "postgres"
    MYSQL_PASSWORD: str = "postgres"
    MYSQL_DATABASE: str = "platformdemo"

    @property
    def database_url(self) -> str:
        """获取数据库连接URL - 优先使用DATABASE_URL环境变量"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # 如果没有DATABASE_URL，则使用MySQL配置构建
        return f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        # return f"postgresql+asyncpg://postgres:postgres@localhost:5432/platformdemo"
    @property
    def mysql_database_url(self) -> str:
        """获取MySQL数据库连接URL（兼容性保留）"""
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"

    # Neo4j图数据库配置
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Milvus向量数据库配置
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530
    MILVUS_COLLECTION_NAME: str = "ui_automation_vectors"

    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    @property
    def redis_url(self) -> str:
        """获取Redis连接URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

class AIModelSettings(BaseSettings):
    """AI模型配置"""

    # DeepSeek配置
    DEEPSEEK_API_KEY: str = "sk-3741f228c58f456e9aaa0b369c5266b8"
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    # Qwen-VL配置
    QWEN_VL_API_KEY: str = "sk-298d078bf69e4662b24f8c0e124d0470"
    QWEN_VL_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_VL_MODEL: str = "qwen-vl-max-latest"

    # UI-TARS配置
    UI_TARS_API_KEY: str = "627358ce-bcdc-4a38-9ff4-04f8fa78e213"
    UI_TARS_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    UI_TARS_MODEL: str = "doubao-1-5-ui-tars-250428"
    UI_TARS_ENDPOINT_URL: str = ""

    # OpenAI配置（备用）
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # 多模态模型优先级配置
    @property
    def multimodal_model_priority(self) -> Dict[str, List[str]]:
        """获取多模态模型优先级配置"""
        return {
            "gui_tasks": ["uitars", "qwen_vl", "deepseek"],
            "general_vision": ["qwen_vl", "uitars", "deepseek"],
            "text_tasks": ["deepseek", "qwen_vl", "uitars"]
        }

    # 默认多模态模型选择策略
    DEFAULT_MULTIMODAL_MODEL: str = "qwen_vl"
class FileStorageSettings(BaseSettings):
    """文件存储配置"""

    # 基础存储配置
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: str = ".pdf,.doc,.docx,.txt,.md,.yaml,.yml"
    ALLOWED_IMAGE_EXTENSIONS: str = ".png,.jpg,.jpeg,.gif,.bmp,.webp"

    @property
    def allowed_extensions_list(self) -> List[str]:
        """获取允许的文件扩展名列表"""
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",")]

    @property
    def allowed_image_extensions_list(self) -> List[str]:
        """获取允许的图片扩展名列表"""
        return [ext.strip() for ext in self.ALLOWED_IMAGE_EXTENSIONS.split(",")]

    # 专用目录配置
    IMAGE_UPLOAD_DIR: str = "uploads/images"
    YAML_OUTPUT_DIR: str = "uploads/yaml"
    PLAYWRIGHT_OUTPUT_DIR: str = "uploads/playwright"
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024  # 10MB


class AutomationSettings(BaseSettings):
    """自动化工具配置"""

    # MidScene.js配置
    MIDSCENE_SERVICE_URL: str = "http://localhost:3002"
    MIDSCENE_TIMEOUT: int = 300  # 5分钟
    MIDSCENE_SCRIPT_PATH: str = ""  # 空字符串，因为UI_UIAUTOMATION_DIR已经指向tests目录
    MIDSCENE_MODEL_NAME: Optional[str] = None  # MidScene.js使用的模型名称
    MIDSCENE_USE_QWEN_VL: Optional[str] = None  # 是否使用Qwen-VL模型

    # Playwright配置
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_TIMEOUT: int = 30000  # 30秒
    PLAYWRIGHT_VIEWPORT_WIDTH: int = 1280
    PLAYWRIGHT_VIEWPORT_HEIGHT: int = 960

    # AutoGen配置
    AUTOGEN_CACHE_ENABLED: bool = True
    AUTOGEN_MAX_ROUND: int = 10
    AUTOGEN_TIMEOUT: int = 600  # 10分钟
class LoggingSettings(BaseSettings):
    """日志配置"""

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"
    LOG_ROTATION: str = "1 day"
    LOG_RETENTION: str = "30 days"


class MonitoringSettings(BaseSettings):
    """监控配置"""

    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 8001
    ENABLE_MONITORING: bool = True


class FeatureSettings(BaseSettings):
    """功能开关配置"""

    ENABLE_CACHING: bool = True
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_ASYNC_PROCESSING: bool = True

    # 混合检索配置
    HYBRID_RETRIEVAL_ENABLED: bool = True
    VECTOR_SEARCH_TOP_K: int = 10
    SIMILARITY_THRESHOLD: float = 0.7


class Settings(
    ApplicationSettings,
    DatabaseSettings,
    AIModelSettings,
    FileStorageSettings,
    AutomationSettings,
    LoggingSettings,
    MonitoringSettings,
    FeatureSettings,
    ProjectSettings
):
    """统一配置类 - 继承所有配置模块"""

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取配置实例（单例模式）"""
    return Settings()


# 全局配置实例
settings = get_settings()
