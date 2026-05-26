---
name: deploy
description: 部署项目到生产环境
arguments:
  - name: environment
    description: 部署环境 (dev/staging/prod)
    required: false
    default: staging
---

请帮我部署项目到 {{environment}} 环境。

执行步骤：
1. 检查当前分支状态
2. 运行测试
3. 构建项目
4. 部署到 {{environment}} 环境
5. 验证部署结果