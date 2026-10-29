import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { generateImage } from './image.js';
import { queueDeliverable } from './deliver.js';

export function registerImageTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'umamusume_draw',
    description: '为当前剧情生成一张图片，并直接展示给用户。默认使用当前角色立绘作为人物参考；只生成纯场景时设 include_character=false。',
    parameters: {
      prompt: { type: 'string', required: true, description: '具体画面描述：场景、动作、表情、服装、构图和光照；不要包含 API 参数。' },
      size: { type: 'string', enum: ['1024x1024', '1024x1536', '1536x1024'], description: '图片尺寸，默认 1024x1024。' },
      quality: { type: 'string', enum: ['auto', 'low', 'medium', 'high'], description: '生成质量，默认 auto。' },
      include_character: { type: 'boolean', description: '是否使用当前角色立绘作为参考，默认 true。' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          character: { type: 'string', required: true },
          attachment: {
            type: 'object', additionalProperties: true,
            properties: {
              attachmentId: { type: 'string', required: true }, mediaType: { type: 'string', required: true },
              bytes: { type: 'number', required: true }, width: { type: 'number', required: true }, height: { type: 'number', required: true }, name: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => [
        { type: 'image', attachment: value.attachment as unknown as ImageAttachmentRef },
        { type: 'text', text: `已生成${value.character}的图片并展示给用户；不要重复粘贴图片链接。` },
      ],
    },
    timeoutMs: 190_000,
    async execute(args, exec) {
      const character = ctx.umamusume.characterForAgent(exec.agent);
      const reference = args.include_character === false || !character.portrait
        ? undefined
        : { data: await ctx.umamusume.portrait(character), name: character.portrait.name };
      const generated = await generateImage(ctx.umamusume, {
        prompt: args.prompt,
        size: args.size ?? '1024x1024',
        quality: args.quality ?? 'auto',
        reference,
        referenceDescription: `${character.name}（${character.nameEn}），保持角色的外观、马耳、尾巴和服装设定。`,
        signal: exec.signal,
      });
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[generated.mediaType];
      const name = `${character.id}-illustration.${extension}`;
      const attachment = await ctx.attachments.saveImage({ data: generated.data, mediaType: generated.mediaType, name });
      const delivery = await ctx.attachments.saveFile({ data: generated.data, name });
      queueDeliverable(ctx, exec, delivery, `${character.name} 的插图`);
      return {
        character: character.name,
        attachment: {
          attachmentId: String(attachment.attachmentId), mediaType: attachment.mediaType,
          bytes: attachment.bytes, width: attachment.width, height: attachment.height,
          ...(attachment.name ? { name: attachment.name } : {}),
        },
      };
    },
  }));
}
