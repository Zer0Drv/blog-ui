# #58 历史前端回滚认证

回滚入口仍为 main 的 CD workflow_dispatch，保留 production 审批。输入 `sha-<8位>`，
工作流先把 MinIO 历史版本下载到本次运行的独立 staging，再核对：

1. 完整 SHA、文件清单和 SHA-256，以及该 manifest 指向的原始成功 main CD。
2. 原始 build/browser-e2e 成功记录与该运行的 Actions 原始 dist。归档自行重算摘要不能替代原始产物。
3. 当前实际后端 revision、Flyway schema/checksum 必须存在于 `.github/release-compatibility.json`。

通过后才将认证副本 mirror 到线上桶；发布后与正常部署一样执行实际网关冒烟，
并确认后端身份没有变化。认证失败不写入线上桶。两仓部署与备份共享
`E:\dev\zer0drv\.deployment.lock`，不得盲目清除占用中的锁。

Actions 原始产物或日志过期、未知版本组合均拒绝回滚。所有者可通过仓库变量
`FRONTEND_ROLLBACK_COMPATIBILITY` 提供同格式的完整矩阵；添加版本前须保存精确版本的
兼容测试证据，变量不能跳过原始 CI/产物验证。产物和冒烟报告保留 90 天。

本轮旧前端 `42185de65f161a484188818cca2e1079e0d72a73` 与后端
`028652b908c6dc29a9dc51b06759ff1905267c2a` 在干净 checkout、独立真实依赖上通过
Chromium 6/6（含 TOTP），run ID `94922602556c41e7be46a60b78c9f779`。
完整现场记录见后端 `docs/compatibility-2026-10-20.md`；尚未执行生产回滚。
