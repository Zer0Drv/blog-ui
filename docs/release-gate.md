# 前端发布门禁（Zer0Drv/blog#58）

## 正常发布

CD 依赖顺序是 `gate → ci → deploy`。`ci` 调用同一提交中的完整 `.github/workflows/ci.yml`，保留 Node 24 / pnpm 12、锁文件严格安装、全量测试、生产构建和产物上传。新增集成/E2E job 放入该 CI 后，也必须完成，调用方才会得到成功结果。不要给必需 job/测试步骤添加条件跳过或 `continue-on-error`。

CI checkout 固定 `github.sha`，测试和构建成功后再次核对 HEAD，生成 `release.json`，记录完整提交 SHA、工作流链接、全部文件的大小与 SHA-256。只有这些步骤完成且上传成功后，才能正常部署。CD 消费同一次调用的 `frontend-dist-<完整 SHA>` artifact，提交不一致、CI 仍在运行/失败/取消/跳过、缺少产物均不放行。独立 push/PR CI 继续保留；因此 main 正常发布仍会有独立 CI 与发布专用 CI 两次运行，与原来 CI/CD 各做 test/build 的成本接近。

部署使用 `production` 环境原有审批。审批后取得同提交的校验脚本与该次调用的产物，在按 run ID/attempt 区分的临时目录中校验，避免自托管 runner 上的旧文件混入。文件缺失/多出/修改、目录链接、清单格式或 SHA 不匹配时，在配置 MinIO 或写入桶之前失败。有效产物仍先 `mc cp` 归档至 `blog-frontend-releases/sha-<8位>/dist/`，再 mirror 到线上桶；归档失败不继续更新线上桶。

GitHub artifact 保留 90 天，PR CI 也执行清单生成和上传，以便在合并前检查实际产物；PR 清单的 SHA 是测试的 merge commit。`release.json` 同时进入归档和线上桶，可从 `/release.json` 读取前端提交和文件清单，便于后续建立跨仓发布记录。它依赖同一次可信 CI 运行的 artifact 传递，属于完整性校验，未实现独立签名或历史产物认证。

## 手动运行与回滚

手动发布与回滚只允许选择 main。push 消息中的 `[skip cd]`（大小写不敏感）继续跳过 CD，独立 CI 照跑；显式手动运行不继承跳过标记。`rollback_tag` 只接受 `sha-` 加 8 位小写十六进制标识，避免把任意分支或路径当作归档。

回滚保留已有行为：跳过当前 CI/重建，在 production 审批后检查历史归档非空，再恢复到线上桶。旧归档没有清单也仍可使用，本次没有更改其目录布局和 `mc cp` 语义。历史产物认证、完整性强校验、非原子恢复过程和回滚后的网关业务冒烟继续由 #58 跟踪；操作者仍须核对目标归档的历史 CI/CD、后端兼容性与回滚时机。

## 验证边界

`tests/releaseWorkflow.spec.js` 验证文件清单、提交错配、文件缺失/修改/多出、异常条目/清单、目录链接，以及真实门控/发布脚本的拒绝顺序。存储调用全部使用函数替身，证明校验失败时没有存储操作、归档失败时不继续 mirror。测试还约束完整 CI 调用、production 审批、精确 SHA 与产物依赖。Windows 上若部署配置路径的 Git Bash 不存在，可设 `WORKFLOW_TEST_BASH`；该环境缺少 Bash 时只跳过脚本子进程用例。CI 的 Ubuntu runner 会执行全部用例。

运行 `pnpm test`、`pnpm build`；工作流语法另用 actionlint 验证。合并后首次 main 发布需确认完整 reusable CI 调用、artifact 下载、校验与 MinIO 同步。测试和本地验证不运行生产同步，也未把真实浏览器或网关业务冒烟计为通过。

本次推进 #58 的前端正常发布门禁；实际网关首页/文章/API 冒烟、前后端与 migration 兼容记录、浏览器 E2E 和备份恢复演练仍待完成。
