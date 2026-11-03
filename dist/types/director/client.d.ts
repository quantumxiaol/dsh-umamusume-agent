import React from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export declare function DirectorDock({ useProjection, useSession, execute }: PropsRuntime<'conversation.input.dock'> & {
    execute: (command: string) => Promise<void>;
}): React.JSX.Element | null;
