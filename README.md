# DSH Umamusume Agent

在 DeepSeek Harness 中与赛马娘角色对话。支持单角色扮演、角色插图、FishSpeech 日语配音、网页搜索和本地剧情检索。

## 1. 安装 DeepSeek Harness

按照 [DeepSeek Harness 官方说明](https://github.com/deepseek-ai/deepseek-harness)安装并打开 Desktop。

选择一种对话模型来源：

- 登录 **DeepSeek 账号**，使用账号提供的模型。
- 配置 **OpenCode Go 套餐**，在模型选择器中使用官方 `opencode-go` 路由。

插件复用 Harness 的模型路由，不需要另外配置对话模型。OpenCode Go 的使用范围见[官方说明](https://opencode.ai/docs/go/)。

## 2. 安装本插件

在 Desktop 打开“插件”→“添加插件”，输入以下任意一种来源：

- 本仓库的 GitHub 地址。
- clone 后的本地目录绝对路径。例如：

  ```bash
  git clone <本仓库的 GitHub 地址>
  ```

  然后在插件安装框中填写 clone 得到的 `dsh-umamusume-agent` 目录路径。

本地路径方式可先复制 `.env.example` 为 `.env`，完成配置后再安装。安装或更新后，请完全重启 Desktop。

## 3. 配置

推荐在 `~/.dsh/.env` 中填写配置；自定义了 `DSH_HOME` 时，改为 `$DSH_HOME/.env`。也可以给 clone 的仓库根目录放置 `.env`，但 Desktop 的全局配置更稳定。

不使用图片生成时，仅配置 FishSpeech 即可：

```dotenv
TTS_ENABLED=false
TTS_PROVIDER=fishspeech
TTS_LANGUAGE=ja
TTS_API_BASE_URL=http://127.0.0.1:8002
TTS_MODEL=s2-pro
TTS_API_KEY=
```

本机 FishSpeech 不需要 API Key，保持 `TTS_API_KEY` 为空。`TTS_ENABLED=false` 表示新会话默认不自动配音，之后可以在会话内随时开启。`TTS_LANGUAGE=ja` 时，角色仍以中文回复，但配音使用日语。

图片生成是可选功能。需要使用 OpenAI 兼容的图像端点时，继续配置：

```dotenv
GENIMG_API_BASE_URL=https://api.openai.com/v1
GENIMG_MODEL=gpt-image-2
GENIMG_API_KEY=你的图像API密钥
```

请按自己的端点修改地址、模型和密钥。修改配置后完全重启 Desktop。完整配置见[配置参考](docs/configuration.md)。

## 4. 部署 FishSpeech TTS

不需要语音时可以跳过本节。

可以使用 [quantumxiaol/fish-speech](https://github.com/quantumxiaol/fish-speech)。按照该仓库说明下载 S2-Pro 权重并安装环境，建议准备 **16GB 或以上显存**；Apple Silicon 需要足够的统一内存。

在 fish-speech 仓库目录中激活环境，然后启动服务：

```bash
fish-tts-server \
  --host 127.0.0.1 \
  --port 8002 \
  --llama-checkpoint-path ./modelsweights/s2-pro \
  --decoder-checkpoint-path ./modelsweights/s2-pro/codec.pth \
  --storage-root ./storage/fish_speech_service \
  --device mps \
  --dtype float16 \
  --max-seq-len 4096
```

该示例使用 Apple Silicon 的 MPS。其他显卡请按照 FishSpeech 文档调整 `--device` 和 `--dtype`。保持服务运行，插件会通过 `http://127.0.0.1:8002/v1/chat/completions` 调用它；本机推理可能需要一些时间。

## 5. 开始对话

1. 新建会话，在 Agent 模式中选择“赛马娘”。
2. 在输入框上方搜索并选择角色。第一条消息前可以更换，开始对话后角色锁定。
3. 直接输入训练员台词或剧情即可。
4. 需要配音时，点击输入框上方的 **TTS 开启/关闭** 按钮。开启后每轮回复自动在后台配音，不必等待合成完成再发下一句。
5. 配置图像端点后，可以说“画一张你在训练场跑步的图片”。

图片和语音附件会显示在各自对应的回复下方。底部角色区域继续显示最新 TTS 任务的排队、翻译、合成进度和播放控件。更换角色请新建会话。

## 更多文档

- [完整配置：图片、搜索与本地剧情检索](docs/configuration.md)
- [架构与开发说明](docs/development.md)
