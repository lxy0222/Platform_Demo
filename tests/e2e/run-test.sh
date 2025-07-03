#!/bin/bash

# 设置AI模型环境变量
export OPENAI_API_KEY="sk-298d078bf69e4662b24f8c0e124d0470"
export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export MIDSCENE_MODEL_NAME="qwen-vl-max-latest"

# 运行Playwright测试
npx playwright test "$@"
