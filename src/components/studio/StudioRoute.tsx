'use client';

import React from 'react';
import type { StudioContest } from '@/actions/contests';
import type { SavedFlagSource } from '@/actions/my-flags';
import type { RemixSource } from './model';
import Studio from './Studio';

type Props = {
  remix: RemixSource | null;
  contest: StudioContest | null;
  saved: SavedFlagSource | null;
};

/**
 * Opens a fresh studio for each flag. When a new flag is saved its address becomes
 * `/create?flag=<id>`. The page can render again for that address (a refresh, or a server action
 * that refreshes it), and that must not start the studio over: you'd lose undo and any open dialog.
 */
export default function StudioRoute({ identity, ...props }: Props & { identity: string }) {
  const live = React.useRef({ identity, key: identity, adopted: null as string | null, props, count: 0 });
  const current = live.current;
  if (identity !== current.identity) {
    const sameFlag = current.adopted !== null && identity === `saved-${current.adopted}`;
    if (!sameFlag) {
      current.count += 1;
      current.key = `${identity}~${current.count}`;
      current.adopted = null;
      current.props = props;
    }
    current.identity = identity;
  }
  const onAdopt = React.useCallback((id: string) => {
    live.current.adopted = id;
  }, []);
  return <Studio key={current.key} {...current.props} onAdopt={onAdopt} />;
}
