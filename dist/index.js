import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Service } from '@deepseek-ai/cordis';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { Config as ConfigSchema, API_KEY_REFS, resolveConfig } from './config.js';
import { loadCharacters } from './characters/loader.js';
import { StoryCatalog } from './story/catalog.js';
import { PRESET_ID, STATE_KEY, CHARACTER_RECORD, TTS_TOGGLE_RECORD, State as stateSchema, PublicState as viewSchema, initialState, reduceState, } from './state.js';
export default class UmamusumeService extends Service {
    static inject = ['agentPresets', 'credentials', 'sessions', 'sessionProjections'];
    static Config = ConfigSchema;
    settings;
    characters;
    byId;
    assetCache = new Map();
    story;
    availability;
    constructor(ctx, config) {
        super(ctx, 'umamusume');
        this.settings = resolveConfig(ctx, config);
        const packageRoot = fileURLToPath(new URL('../', import.meta.url));
        const directory = this.settings.charactersDirectory || fileURLToPath(new URL('../characters/', import.meta.url));
        this.characters = loadCharacters(directory);
        this.byId = new Map(this.characters.map(character => [character.id, character]));
        this.character(this.settings.defaultCharacter);
        const storyDirectory = resolve(packageRoot, this.settings.STORY_DIRECTORY || 'story/character_story');
        if (this.settings.STORY_DIRECTORY || existsSync(storyDirectory)) {
            try {
                const mapping = this.settings.STORY_CHARACTER_MAP
                    ? resolve(packageRoot, this.settings.STORY_CHARACTER_MAP)
                    : this.settings.STORY_DIRECTORY
                        ? resolve(storyDirectory, '../../umamusume_characters.json')
                        : resolve(packageRoot, 'story/umamusume_characters.json');
                this.story = StoryCatalog.load(storyDirectory, mapping);
            }
            catch (error) {
                this.ctx.logger.warn('Umamusume story retrieval disabled: %s', error instanceof Error ? error.message : String(error));
            }
        }
        ctx.sessionProjections.register({
            key: STATE_KEY,
            stateVersion: 1,
            stateSchema,
            init: header => initialState(header.agentPreset === PRESET_ID, this.settings.defaultCharacter, this.settings.TTS_ENABLED === 'true'),
            apply: reduceState,
            wire: {
                viewSchema,
                view: state => ({
                    ...state,
                    catalog: this.characters.map(character => ({ id: character.id, name: character.name, nameEn: character.nameEn })),
                }),
            },
        });
    }
    async *[Service.init]() {
        const account = this.ctx.get('deepseekAccount');
        const accountState = account ? await account.getState() : undefined;
        this.availability = {
            asr: await this.configured('asr'),
            tts: this.settings.TTS_PROVIDER === 'fishspeech' || await this.configured('tts'),
            image: await this.configured('image'),
            search: (await this.configured('search')) || accountState?.status === 'credential-stored',
            story: Boolean(this.story),
        };
        this.ctx.logger.info('Umamusume capabilities: image=%s, tts=%s, asr=%s, search=%s, story=%s', this.availability.image, this.availability.tts, this.availability.asr, this.availability.search, this.availability.story);
        yield await this.ctx.agentPresets.register(this.presetDefinition());
    }
    character(id) {
        const character = this.byId.get(id);
        if (!character)
            throw new Error(`未知角色：${id}`);
        return character;
    }
    characterForAgent(agent) {
        return this.character(agent ? this.sessionState(agent).character : this.settings.defaultCharacter);
    }
    sessionState(agent) {
        const state = this.ctx.sessionProjections.stateOf(agent.session, STATE_KEY);
        if (!state)
            throw new Error('赛马娘会话状态不可用。');
        return state;
    }
    capabilitiesFor(character, agent) {
        const needsReference = this.settings.TTS_PROVIDER === 'fishspeech' || this.settings.TTS_MODEL === 'mimo-v2.5-tts-voiceclone';
        const hasReference = this.settings.TTS_PROVIDER === 'fishspeech'
            ? Boolean(character.referenceAudio && character.referenceText)
            : Boolean(character.referenceAudio);
        return {
            image: this.availability.image,
            asr: this.availability.asr,
            search: this.availability.search,
            story: Boolean(this.storyFor(character)),
            tts: this.availability.tts && (!needsReference || hasReference) && (!agent || this.sessionState(agent).ttsEnabled),
        };
    }
    configure({ agent, rawInput }) {
        const state = this.sessionState(agent);
        if (!state.enabled)
            return { kind: 'error', text: '请先新建会话并选择“赛马娘”。' };
        if (agent.status !== 'idle')
            return { kind: 'error', text: '请先停止或等待当前回复完成。' };
        const [, verb = '', argument = ''] = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rawInput.trim()) ?? [];
        if (verb === 'tts') {
            if (argument !== 'on' && argument !== 'off')
                return { kind: 'error', text: '用法：/uma tts on 或 /uma tts off' };
            const enabled = argument === 'on';
            appendPluginRecord(this.pluginSession(agent), TTS_TOGGLE_RECORD, { version: 1, enabled });
            return { kind: 'success', text: `本会话 TTS 已${enabled ? '开启' : '关闭'}` };
        }
        if (verb !== 'character')
            return { kind: 'success', text: '用法：/uma character <角色ID、中文名或英文名>；/uma tts on|off' };
        if (state.started)
            return { kind: 'error', text: '本会话已开始；更换角色请新建会话。' };
        const normalized = argument.trim().toLowerCase();
        const character = this.characters.find(row => row.id.toLowerCase() === normalized
            || row.name.toLowerCase() === normalized || row.nameEn.toLowerCase() === normalized);
        if (!character)
            return { kind: 'error', text: '角色不存在，请从会话内角色列表选择。' };
        appendPluginRecord(this.pluginSession(agent), CHARACTER_RECORD, { version: 1, character: character.id });
        return { kind: 'success', text: `已选择 ${character.name}` };
    }
    pluginSession(agent) {
        const session = this.ctx.sessions.get(agent.id);
        if (!session)
            throw new Error('当前会话不可用，请重新打开会话后再试。');
        return session;
    }
    storyFor(character) {
        return this.story?.storyFor(character);
    }
    async portrait(character) {
        if (!character.portrait)
            throw new Error(`角色 ${character.name} 没有可用立绘。`);
        return this.readAsset(character.portrait);
    }
    async voiceReference(character) {
        if (!character.referenceAudio)
            throw new Error(`角色 ${character.name} 没有参考音频，不能使用声音克隆。`);
        return (await this.readAsset(character.referenceAudio)).toString('base64');
    }
    async optionalApiKey(capability) {
        const resolved = await this.ctx.credentials.resolve(credentialRef(API_KEY_REFS[capability]));
        return resolved?.value;
    }
    async apiKey(capability) {
        const value = await this.optionalApiKey(capability);
        if (!value)
            throw new Error(`未配置 ${API_KEY_REFS[capability]}。`);
        return value;
    }
    async configured(capability) {
        return (await this.ctx.credentials.describe(credentialRef(API_KEY_REFS[capability]))).configured;
    }
    readAsset(asset) {
        let cached = this.assetCache.get(asset.path);
        if (!cached) {
            cached = readFile(asset.path);
            this.assetCache.set(asset.path, cached);
            cached.catch(() => this.assetCache.delete(asset.path));
        }
        return cached;
    }
    presetDefinition() {
        return {
            id: PRESET_ID,
            name: '赛马娘',
            description: '选择一位赛马娘进行角色扮演；使用 Harness 原生会话、模型路由与上下文压缩。',
            order: 50,
            plugins: [
                { id: 'umamusume-character', name: 'dsh-umamusume-agent/preset' },
                { id: 'umamusume-commands', name: 'dsh-umamusume-agent/commands' },
                ...(this.availability.search ? [{
                        id: 'deepseek-search',
                        name: 'cordis:group',
                        group: true,
                        isolate: { web: true },
                        config: [
                            { id: 'web', name: '@deepseek-ai/dsh-web', config: { searchProvider: 'deepseek-search-api' } },
                            { id: 'web-deepseek-api', name: '@deepseek-ai/dsh-web-deepseek-api', config: { apiKeyEnv: 'DEEPSEEK_API_KEY', count: 5, sendOriginalQuestion: true } },
                            { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { search: true, fetch: false, searchMaxQueries: 2, searchMaxResults: 5, searchTimeoutMs: 60000 } },
                        ],
                    }] : []),
                {
                    id: 'compaction',
                    name: 'cordis:group',
                    group: true,
                    isolate: { compaction: true, toolResultPruner: true },
                    config: [
                        { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
                        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
                        {
                            id: 'tool-result-pruner',
                            name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
                            config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
                        },
                    ],
                },
            ],
        };
    }
}
