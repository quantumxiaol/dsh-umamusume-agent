# 架构与开发说明

## 运行架构

本插件不需要旧项目的 Python、FastAPI 或单独前端服务，运行时为纯 TypeScript。

- 只有一个 `umamusume` preset，角色在输入区搜索选择，不为每个角色占用 Agent 模式。
- 首条用户消息后角色锁定；角色和 TTS 状态通过 DSH projection 持久化，重启后恢复。
- 对话、模型路由、流式回复、停止、会话日志、历史恢复和上下文压缩均使用 Harness 原生能力。
- 主 Agent 不直接管理供应商会话 ID。OpenCode Go 等路由由宿主发送所需的稳定会话请求头。
- `umamusume_speak` 和自动配音只创建后台任务；任务按顺序合成，不阻塞下一轮输入。
- 图片和语音通过原生附件服务持久化，并以 `deliverables/presented` 按轮次交付，不把 Base64 放进对话历史。
- 本地剧情按需限量检索；网页搜索复用 DSH 原生 DeepSeek Search provider。

## 缓存与上下文

- 角色 persona 在会话期间保持稳定，不逐轮重排角色卡，以利于供应商前缀缓存。
- 使用 `dsh-compaction-basic`、`/compact` 和工具结果修剪，不维护第二份对话历史。
- 剧情检索限制摘录数与长度，网页搜索限制查询与来源数。
- 立绘和参考音频首次使用时读取并缓存；密钥按操作从 credentials 解析。
- 图片生成使用角色参考图时优先 `/images/edits`，仅在 404 时回退 `/images/generations`，避免其他错误导致重复付费请求。
- 原始 HTTP JSON、搜索原始输出、参考音频和辅助翻译过程不进入主会话历史。

## 开发环境

要求 Node.js 22+，以及兼容 `0.2.1-rc.2` 的 DSH 0.2.x 运行时。

```bash
npm ci
npm run typecheck
npm test
npm run check:build
npm pack --dry-run
```

也可以一次执行：

```bash
npm run check
```

`check` 会先校验仓库中的 `dist/` 是否与源码一致，再运行类型检查和测试。修改源码后先执行 `npm run build` 并提交更新后的 `dist/`；CI 不会用测试期间的构建掩盖遗漏的产物。

`npm test` 会先构建，再运行离线测试。真实付费 API 测试默认跳过，CI 不产生调用费用。配置好真实图像和兼容媒体端点后，可显式执行：

```bash
UMA_LIVE_API_TEST=1 npm run test:tools:live
```

该手动测试会调用真实接口并产生费用。

## 本地安装与验收

仓库直接携带 `dist/`，本地、tarball 或 Git 安装都不需要执行安装期构建脚本。修改源码后：

```bash
npm run build
dsh plugin --profile web add "$PWD"
```

将 `web` 换成实际 profile。Desktop 也可以在插件安装界面选择本仓库绝对路径。更新后完全重启 DSH。

## 角色资产同步

```bash
npm run characters:sync -- /absolute/path/to/umamusume-agent/characters
```

同步只复制 `config.json`、`prompt.md`、立绘、参考音频和参考文本，不复制旧后端、notes 或 outputs。源媒体需要已通过 Git LFS 拉取。

## 发布检查

版本号位于根目录 `package.json`，运行 `npm install --package-lock-only` 同步锁文件。发布前执行：

```bash
npm run check
npm pack --dry-run
```

`story/` 和 `.env` 不应进入提交或 npm 包。剧情文本只保留在有使用权的本地目录，不作为项目资产分发。

## CI 与 Release

- `.github/workflows/ci.yml` 在 `main` 分支推送、Pull Request 和手动触发时执行 `npm ci`、`npm run check` 与 `npm pack --dry-run`，不会运行真实付费 API 测试。
- `.github/workflows/release.yml` 在推送 `v*` 标签时执行同一套检查，校验标签与 `package.json` 版本一致，然后运行 `npm pack` 并将 `.tgz` 上传到对应的 GitHub Release。
- Release 使用 GitHub Actions 内置的 `GITHUB_TOKEN`，不需要 npm registry 密钥，也不会自动执行 `npm publish`。重复运行时，已存在的 Release 会更新同名包附件。

发布 0.1.0 的示例：

```bash
git tag v0.1.0
git push origin v0.1.0
```

推送前确认 `package.json` 和 `package-lock.json` 的版本均为 `0.1.0`，并等待 CI 与 Release 工作流成功。

## 当前边界

- 当前是单角色会话；多角色/导演模式尚未实现。
- 不迁移旧网站历史、旧 JSON 对话协议或测试版按角色 preset 创建的会话。
- 暂无录音按钮、自动播放或独立日记系统；长会话继续由 DSH 原生压缩管理。
