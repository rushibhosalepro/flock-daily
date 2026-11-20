import { showToast } from '@devvit/web/client';

export const copyText = async (text: string, done: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(done);
  } catch {
    showToast('Could not copy. Select the text and copy it by hand.');
  }
};
