import { getShareData, showShareSheet } from '@devvit/web/client';
import { copyText } from './clipboard.ts';

/**
 * Opens Reddit's share sheet (or copies the link on desktop). The data travels
 * with the link and comes back through readShareData when a friend opens it.
 * If the share sheet is not available, the text is copied instead.
 */
export const shareResult = async (
  title: string,
  text: string,
  data: string
): Promise<void> => {
  try {
    await showShareSheet({ title, text, data });
  } catch {
    await copyText(text, 'Result copied');
  }
};

/** Data from the share link this post was opened with, if any. Never throws. */
export const readShareData = (): string | undefined => {
  try {
    return getShareData();
  } catch {
    return undefined;
  }
};
