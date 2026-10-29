# 配置参考

插件的可选能力互不影响。对应密钥或本地资源未配置时，相应工具不会提供给 Agent。首次填入、修改或移除配置后，完全重启 DSH。

## 配置文件

推荐写入 `~/.dsh/.env`；自定义了 `DSH_HOME` 时使用 `$DSH_HOME/.env`。clone 仓库后也可以执行：

```bash
cp .env.example .env
```

DSH 按“进程环境 → 启动目录 `.env` → `$DSH_HOME/.env`”的优先级读取变量。Desktop 或从其他目录启动时，优先使用 `$DSH_HOME/.env` 或 DSH credentials。

不要把真实密钥写进 `cordis.patch.yml`、角色卡或会话消息，也不要提交 `.env`。

## FishSpeech TTS

```dotenv
TTS_ENABLED=false
TTS_PROVIDER=fishspeech
TTS_LANGUAGE=ja
TTS_API_BASE_URL=http://127.0.0.1:8002
TTS_MODEL=s2-pro
TTS_API_KEY=
```

- 实际请求 `POST {TTS_API_BASE_URL}/v1/chat/completions`，发送角色参考音频的裸 Base64 和对应的 `reference_jp.txt`。
- 本机服务通常不需要鉴权，`TTS_API_KEY` 留空即可；云端 FishSpeech 如需密钥，可以填写。
- `TTS_LANGUAGE=ja` 时，独立辅助 Agent 将中文台词翻译成日语后配音。翻译提示和结果不会进入主会话历史；改为 `zh` 时不做日语翻译。
- 单次对白最多 4000 字，后台任务开始执行后最多 10 分钟，包含日文翻译和语音请求。
- `TTS_ENABLED` 只决定新会话的默认状态。会话内按钮或 `/uma tts on`、`/uma tts off` 可独立切换，并在重启后恢复。
- 开启后，每条最终回复自动进入后台配音；也可以明确要求角色朗读指定对白。动作、Markdown 和代码会被过滤。
- 合成完成后，带 `.mp3` 扩展名的附件卡片显示在对应回复下。底部保留最新任务的状态、播放器和下载链接，不自动播放。

FishSpeech 部署可使用 [quantumxiaol/fish-speech](https://github.com/quantumxiaol/fish-speech)，服务启动命令见根目录 [README](../README.md#4-部署-fishspeech-tts)。

## 图片生成

```dotenv
GENIMG_API_BASE_URL=https://api.openai.com/v1
GENIMG_MODEL=gpt-image-2
GENIMG_API_KEY=
```

- 使用 OpenAI 兼容协议和 `Authorization: Bearer GENIMG_API_KEY`。
- 默认使用当前角色立绘调用 `POST {GENIMG_API_BASE_URL}/images/edits`；纯场景使用 `/images/generations`。
- 网关不支持 `/images/edits` 并返回 404 时，自动回退到 `/images/generations`，改用角色外观文字描述。其他错误不会触发第二次付费请求。
- 支持 Base64 和 URL 响应，以及 PNG、JPEG、WebP、GIF，单图最大 32MB。
- 生成图片会以带正确扩展名的文件卡片交付到对应回复下。自定义网关请按实际支持的模型修改 `GENIMG_MODEL`。
- 自定义图像网关建议使用 HTTPS，避免密钥通过明文 HTTP 泄露。

## DeepSeek 网页搜索

```dotenv
DEEPSEEK_API_KEY=
```

- DeepSeek 账号登录或 `DEEPSEEK_API_KEY` 任一可用即可启用。
- 使用账号时，聊天模型需走 `deepseek-account` 路由，DSH 原生 provider 会复用账号凭据；使用 OpenCode Go 等其他聊天路由时，搜索仍需 `DEEPSEEK_API_KEY`。
- 插件复用 DSH 原生 `web_search`，实际请求 `POST https://api.deepseek.com/v1/tools/search`。
- 每次最多 2 个查询、5 个来源，不开放 `web_fetch`，避免长网页正文挤占角色上下文。
- 登录状态或密钥变更后重启 DSH。搜索 API 计费见[官方说明](https://api-docs.deepseek.com/zh-cn/guides/search/)。

## 本地剧情检索

剧情文本可能涉及版权或 DMCA，只应读取自己有权使用的本地资料，不要分发。`story/` 已加入 `.gitignore`，不会进入 Git 或 npm 包。

将本地资料放在插件目录：

```text
story/
├── character_story/
└── umamusume_characters.json
```

默认配置：

```dotenv
STORY_DIRECTORY=story/character_story
STORY_CHARACTER_MAP=story/umamusume_characters.json
```

也可以从自己的 crawler 副本更新：

```bash
cp -R /absolute/path/to/umamusume-web-crawler/results/character_story ./story/
cp /absolute/path/to/umamusume-web-crawler/umamusume_characters.json ./story/
```

- 目录和映射存在时，拥有对应剧情文件的角色才会注册 `umamusume_story_search`。
- 工具只检索当前角色的一份 Markdown，以 `rg` 固定字符串搜索；无 `rg` 时使用 `grep`。
- 默认返回最多 5 组带行号的短摘录，可指定最多 8 组，不会把整份剧情注入上下文。
- 检索用于核对原作事实，不表示原作事件已在当前会话发生。
- 外部 `STORY_DIRECTORY` 与留空的 `STORY_CHARACTER_MAP` 一起使用时，默认读取 `STORY_DIRECTORY/../../umamusume_characters.json`。

## 可选非密钥覆盖

非密钥字段也可以在 profile 的 `cordis.patch.yml` 中设置：

```yaml
- id: umamusume
  config:
    charactersDirectory: /absolute/path/to/custom-characters
    defaultCharacter: rice_shower
    STORY_DIRECTORY: story/character_story
    STORY_CHARACTER_MAP: story/umamusume_characters.json
    TTS_ENABLED: 'false'
    TTS_PROVIDER: fishspeech
    TTS_LANGUAGE: ja
    TTS_API_BASE_URL: http://127.0.0.1:8002
    TTS_MODEL: s2-pro
    GENIMG_API_BASE_URL: https://api.openai.com/v1
    GENIMG_MODEL: gpt-image-2
```

Harness patch 会替换该行的整个 `config`，但空字段会继续使用环境变量和默认值。
