import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import {
  EMPTY_DRAFT,
  STUDIO_SIZE,
  applyTool,
  checkLevel,
  draftLevel,
  itemAt,
  missingPieces,
} from '../../shared/engine/studio.ts';
import type { Draft, Tool } from '../../shared/engine/studio.ts';
import { twistPhrase } from '../../shared/engine/share.ts';
import { postStudioBoard } from '../api.ts';
import { BIRD_LABELS } from '../constants.ts';
import { BirdArt, FeatherArt, NestArt, WallArt } from './Art.tsx';

type ToolButton = { tool: Tool; label: string; art: ReactNode };

const TOOLS: readonly ToolButton[] = [
  { tool: { kind: 'hedge' }, label: 'Hedge', art: <WallArt /> },
  ...([0, 1, 2] as const).map((bird) => ({
    tool: { kind: 'bird', bird } satisfies Tool,
    label: BIRD_LABELS[bird],
    art: <BirdArt index={bird} contrary={false} />,
  })),
  ...([0, 1, 2] as const).map((bird) => ({
    tool: { kind: 'nest', bird } satisfies Tool,
    label: `${BIRD_LABELS[bird].replace(' bird', '')} nest`,
    art: <NestArt index={bird} />,
  })),
  { tool: { kind: 'feather' }, label: 'Golden feather', art: <FeatherArt /> },
  {
    tool: { kind: 'twist' },
    label: 'Twist: tap a bird to make it fly the other way',
    art: <span className="erase-glyph twist-glyph">⇄</span>,
  },
  { tool: { kind: 'erase' }, label: 'Eraser', art: <span className="erase-glyph">⌫</span> },
];

const sameTool = (a: Tool, b: Tool): boolean =>
  a.kind === b.kind && ('bird' in a ? a.bird : -1) === ('bird' in b ? b.bird : -1);

const pos = (cell: number): CSSProperties => {
  const vars: Record<string, number> = {
    '--r': Math.floor(cell / STUDIO_SIZE),
    '--c': cell % STUDIO_SIZE,
  };
  return vars;
};

const joinList = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const cellName = (draft: Draft, cell: number): string => {
  const item = itemAt(draft, cell);
  const where = `row ${Math.floor(cell / STUDIO_SIZE) + 1}, column ${(cell % STUDIO_SIZE) + 1}`;
  if (!item) return `Empty, ${where}`;
  const tool = TOOLS.find((t) => sameTool(t.tool, item));
  return `${tool?.label ?? 'Piece'}, ${where}`;
};

const CELLS = Array.from({ length: STUDIO_SIZE * STUDIO_SIZE }, (_, i) => i);

/**
 * Flock Studio: build a board, let the solver check it, and post it to the
 * subreddit. Pick a piece, then tap cells. The status line updates on every
 * tap, so the player always knows whether the board can be posted.
 */
export const Studio = ({
  loggedIn,
  onClose,
}: {
  loggedIn: boolean;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tool, setTool] = useState<Tool>({ kind: 'hedge' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const checked = useMemo(() => {
    const level = draftLevel(draft);
    return level ? { level, check: checkLevel(level) } : null;
  }, [draft]);

  const missing = missingPieces(draft);
  const twist = twistPhrase(draft.kinds);
  const ready = checked !== null && checked.check.ok;
  const status: { text: string; tone: 'hint' | 'bad' | 'ok' } =
    tool.kind === 'twist' && missing.length > 0
      ? { text: 'Tap a bird to make it fly opposite to the swipe. Tap again to undo.', tone: 'hint' }
      : missing.length === 6
      ? { text: 'Pick a piece, then tap the board. You need 3 birds and their nests.', tone: 'hint' }
      : missing.length > 0
        ? { text: `Still to place: ${joinList(missing)}.`, tone: 'hint' }
        : checked === null
          ? { text: '', tone: 'hint' }
          : !checked.check.ok
            ? { text: checked.check.reason, tone: 'bad' }
            : {
                text:
                  checked.check.crownPar !== null
                    ? `✓ Par ${checked.check.par} · 👑 Crown par ${checked.check.crownPar}${twist ? ' · ⇄ Twist' : ''}`
                    : `✓ Par ${checked.check.par}${twist ? ' · ⇄ Twist' : ''}. Add a feather for a Crown, if you like.`,
                tone: 'ok',
              };

  const post = async () => {
    if (!checked || !checked.check.ok || posting) return;
    setPosting(true);
    try {
      const { url } = await postStudioBoard(checked.level);
      showToast('Puzzle posted! Opening it now.');
      try {
        navigateTo(url);
      } catch {
        onClose();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not post the puzzle');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="studio" role="dialog" aria-modal="true" aria-label="Flock Studio">
      <div className="studio-stage">
        <header className="studio-head">
          <h2>✏️ Flock Studio</h2>
          <button
            type="button"
            className="close-btn"
            aria-label="Close Flock Studio"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="studio-board-wrap">
          <div className="board studio-board">
            {CELLS.map((cell) => {
              const r = Math.floor(cell / STUDIO_SIZE);
              const c = cell % STUDIO_SIZE;
              return (
                <button
                  key={cell}
                  type="button"
                  className={`cell ${(r + c) % 2 === 0 ? 'tile-a' : 'tile-b'}`}
                  style={pos(cell)}
                  aria-label={cellName(draft, cell)}
                  onClick={() => setDraft((d) => applyTool(d, tool, cell))}
                />
              );
            })}
            {draft.walls.map((cell) => (
              <div key={`w${cell}`} className="piece wall" style={pos(cell)}>
                <WallArt variant={cell} />
              </div>
            ))}
            {draft.feather !== null ? (
              <div className="piece feather" style={pos(draft.feather)}>
                <FeatherArt />
              </div>
            ) : null}
            {([0, 1, 2] as const).map((bird) => {
              const cell = draft.nests[bird];
              return cell === null ? null : (
                <div key={`n${bird}`} className="piece nest" style={pos(cell)}>
                  <NestArt index={bird} />
                </div>
              );
            })}
            {([0, 1, 2] as const).map((bird) => {
              const cell = draft.starts[bird];
              return cell === null ? null : (
                <div key={`b${bird}`} className="piece bird" style={pos(cell)}>
                  <BirdArt index={bird} contrary={draft.kinds[bird] === 'contrary'} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="studio-tools" role="group" aria-label="Pieces">
          {TOOLS.map((t) => {
            const on = sameTool(t.tool, tool);
            return (
              <button
                key={t.label}
                type="button"
                className={`tool${on ? ' on' : ''}`}
                aria-label={t.label}
                aria-pressed={on}
                title={t.label}
                onClick={() => setTool(t.tool)}
              >
                {t.art}
              </button>
            );
          })}
        </div>

        <p className={`studio-status ${status.tone}`} aria-live="polite">
          {status.text}
        </p>

        <div className="studio-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setDraft(EMPTY_DRAFT)}
            disabled={posting}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void post()}
            disabled={!ready || posting || !loggedIn}
          >
            {!loggedIn ? 'Log in to post' : posting ? 'Posting…' : 'Post puzzle'}
          </button>
        </div>
      </div>
    </div>
  );
};
