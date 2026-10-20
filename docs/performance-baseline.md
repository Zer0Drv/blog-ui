# 页面性能基线（blog#58）

`pnpm test:performance` 测量生产 `dist`，通过 Vite preview 连接隔离的真实 Spring Boot/MySQL/Redis/MinIO；不测 Vite 开发模块，不访问部署网关或生产账号。复用已批准的 Playwright，无新增依赖。

## 固定条件

- Chromium；1365×900、DPR 1、zh-CN、UTC；CPU 四倍降速，40 ms 延迟、下载 200,000 B/s、上传 93,750 B/s。JSON 同时记录浏览器/Node 版本、CPU 型号和两仓完整 SHA；不同硬件的绝对耗时不可直接比较。
- 首页、公开文章页、已登录编辑页各三次；每次新 context、禁用 HTTP 缓存、阻止 Service Worker。登录在测量前通过真实 API 完成，凭据/Cookie 不写入报告。
- 独立测试库内固定 Markdown 样例：代码、公式、Mermaid 图及二十节正文。正文 SHA-256 和字节数入报告。页面就绪后观察两秒，再点击输入框、按 End、以 100 ms 间隔输入五个字符，最后观察一秒。
- 首页输入搜索框，文章页输入导航搜索框，编辑页输入标题；不提交搜索或保存文章。文章页同时断言代码、公式和图表可见。

## 数据口径

`e2e-artifacts/performance.json` 保存九次原始样本及每页中位数。`complete: false` 表示采样中断，不能作为完整基线。

| 数据 | 口径 |
| --- | --- |
| JS/CSS raw、gzip、brotli | `assets`/`totals` 为窗口内完成的 Resource Timing 资源；`requestedAssets` 为所有已发起的同源 JS/CSS（含在途请求）。去重后读取 dist，gzip level 9、Brotli quality 11 独立压缩估算，不代表部署网关已开启对应编码 |
| 请求列表 | `resources` 为已完成 Resource Timing 路径、类型、耗时、transferSize/encodedBodySize（不含主文档）；`network` 同时记录已发起请求的 pending/finished/failed 状态（含主文档）。不收集 query、请求头或响应正文 |
| FCP/LCP | 当前导航及观察窗口内 PerformanceObserver 的绘制时间；LCP 在首次用户交互后停止更新 |
| CLS | 排除近期用户输入导致的 shift，取间隔小于一秒、累计小于五秒的最大会话窗口 |
| longTaskMs | 观察窗口内长任务总耗时，非 Lighthouse TBT |
| labInteractionMaxMs | 有限脚本交互的 Event Timing 最大值，同 interactionId 合并；不是现场 INP，也不是跨用户 p75 |

Event Timing 最低上报阈值为 16 ms，若没有上报则交互结果为 `null`，不能当作 0 ms。真实用户 INP 需要覆盖完整访问周期和真实交互；本基线只提供可复现的实验室交互代理指标。三次样本不足以代表真实用户分布，不能据此宣布通过 Core Web Vitals。

## 复现与 CI

按 [浏览器隔离规程](browser-e2e.md) 准备 JDK、Node、pnpm、Docker 和已编译后端夹具。在前端目录：

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run build
$env:BACKEND_E2E_DIR='E:\dev\zer0drv\blog'
pnpm test:performance
```

Linux 使用 `BACKEND_E2E_DIR=/path/to/blog pnpm test:performance`。端口被占用时直接拒绝，不停止其他进程。测量结束清理本轮容器和子进程；失败时沿用 `node e2e/cleanup.mjs`。

前端 reusable CI 的 `performance-baseline` 必须完成采样、页面功能断言及清理；不以不稳定的毫秒阈值阻断发布。原始 JSON、三个页面截图及诊断日志保存为 `performance-<SHA>-<attempt>` artifact，保留 90 天。已有全量 Vitest、构建、业务 E2E 仍独立执行。

比较优化时，使用相同脚本/硬件/夹具/节流条件，保留优化前后原始数据。优先比较确定性的资源体积与加载范围，再讨论时间变化；不得调高 chunk warning 阈值代替优化，也不得移除消毒、公式、代码或图表功能。

参考：[INP 定义与测量边界](https://web.dev/articles/inp)、[Chromium Network 节流](https://chromedevtools.github.io/devtools-protocol/tot/Network/)、[CPU 节流](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/)。
