import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLeetcodeEditorState,
  getLeetcodeEditorStateKeys,
  isLeetcodeEditorStateKey,
  setupClearEditorOnReview,
} from '../editor-state';
import { sendMessage } from '@/shared/messages';

// @vitest-environment happy-dom

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  sendMessage: vi.fn(),
}));

describe('LeetCode editor state keys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    history.replaceState({}, '', '/');
  });

  it('should match legacy frontend-id editor keys', () => {
    expect(isLeetcodeEditorStateKey('1_python3_code', { questionFrontendId: '1' })).toBe(true);
    expect(isLeetcodeEditorStateKey('11_python3_code', { questionFrontendId: '1' })).toBe(false);
    expect(isLeetcodeEditorStateKey('1_python3_testcase', { questionFrontendId: '1' })).toBe(false);
  });

  it('should match ugc editor keys by backend question id', () => {
    expect(isLeetcodeEditorStateKey('ugc_user-slug_123_python3_code', { questionId: '123' })).toBe(true);
    expect(isLeetcodeEditorStateKey('ugc_user-slug_123_javascript_code', { questionId: '123' })).toBe(true);
    expect(isLeetcodeEditorStateKey('ugc_user-slug_123_python3_testcase', { questionId: '123' })).toBe(false);
    expect(isLeetcodeEditorStateKey('ugc_user-slug_1234_python3_code', { questionId: '123' })).toBe(false);
  });

  it('should return only matching storage keys', () => {
    localStorage.setItem('1_python3_code', '"draft"');
    localStorage.setItem('ugc_user-slug_123_python3_code', '{"code":"draft"}');
    localStorage.setItem('1_python3_testcase', '[]');
    localStorage.setItem('2_python3_code', '"other"');

    expect(getLeetcodeEditorStateKeys(localStorage, { questionFrontendId: '1', questionId: '123' }).sort()).toEqual([
      '1_python3_code',
      'ugc_user-slug_123_python3_code',
    ]);
  });

  it('should clear only editor state for the requested problem', () => {
    localStorage.setItem('1_python3_code', '"draft"');
    localStorage.setItem('ugc_user-slug_123_python3_code', '{"code":"draft"}');
    localStorage.setItem('2_python3_code', '"other"');

    expect(clearLeetcodeEditorState({ questionFrontendId: '1', questionId: '123' }).sort()).toEqual([
      '1_python3_code',
      'ugc_user-slug_123_python3_code',
    ]);
    expect(localStorage.getItem('1_python3_code')).toBeNull();
    expect(localStorage.getItem('ugc_user-slug_123_python3_code')).toBeNull();
    expect(localStorage.getItem('2_python3_code')).toBe('"other"');
  });

  it('should clear the destination problem during SPA navigation', async () => {
    vi.useFakeTimers();
    history.replaceState({}, '', '/problems/first-problem/');
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ shouldClear: false })
      .mockResolvedValueOnce({ shouldClear: true, questionFrontendId: '2' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    localStorage.setItem('1_python3_code', 'first draft');
    localStorage.setItem('2_python3_code', 'second draft');

    const dispose = setupClearEditorOnReview();
    await vi.advanceTimersByTimeAsync(0);

    history.pushState({}, '', '/problems/second-problem/');
    await vi.advanceTimersByTimeAsync(250);

    expect(localStorage.getItem('1_python3_code')).toBe('first draft');
    expect(localStorage.getItem('2_python3_code')).toBeNull();
    dispose();
  });
});
