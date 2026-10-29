import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const MAX_EXCERPT_CHARS = 900;
export async function searchStory(source, query, limit, signal) {
    const count = Math.max(1, Math.min(8, limit));
    const args = [
        '--line-number', '--context', '2', '--fixed-strings', '--ignore-case',
        '--max-count', String(count + 1), '--max-columns', '800', '--max-columns-preview',
        '--color', 'never', '--', query, source.path,
    ];
    let stdout;
    try {
        stdout = await run('rg', args, signal);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
        stdout = await run('grep', ['-n', '-i', '-C', '2', '-F', '-m', String(count + 1), '--', query, source.path], signal);
    }
    const groups = stdout.split(/\n--\r?\n/).map(parseGroup).filter((match) => Boolean(match));
    return { matches: groups.slice(0, count), truncated: groups.length > count };
}
async function run(command, args, signal) {
    try {
        const { stdout } = await execFileAsync(command, args, { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024, signal });
        return stdout;
    }
    catch (error) {
        const code = error.code;
        if (code === 1 || code === '1')
            return '';
        throw error;
    }
}
function parseGroup(group) {
    const firstMatch = group.match(/^(\d+):/m);
    if (!firstMatch)
        return undefined;
    const excerpt = group.split(/\r?\n/)
        .filter(line => !line.includes('<sub>') && !line.includes('story_id='))
        .map(line => line.replace(/^\d+[:-]/, '').replace(/<br\s*\/?>/gi, ' / ').trim())
        .filter(Boolean)
        .join('\n');
    if (!excerpt)
        return undefined;
    return { line: Number(firstMatch[1]), excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS) + (excerpt.length > MAX_EXCERPT_CHARS ? '…' : '') };
}
