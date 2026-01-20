import { createLeetSrsButton, extractProblemData, RatingMenu, Tooltip } from '@/utils/content';
import { sendMessage, MessageType } from '@/shared/messages';
import { browser } from 'wxt/browser';
import type { Grade } from 'ts-fsrs';
import { i18n } from '@/shared/i18n';

export default defineContentScript({
  matches: ['*://*.leetcode.com/*', '*://neetcode.io/*', '*://*.neetcode.io/*'],
  runAt: 'document_idle',
  async main() {
    // Wake up service worker so it's ready when user interacts
    try {
      await sendMessage({ type: MessageType.PING });
    } catch (error) {
      console.error('Failed to ping service worker:', error);
    }
    if (isNeetcodeHost()) {
      setupNeetcodeLeetSrsButton();
      setupNeetcodeAutoClear();
      return;
    }

    setupLeetSrsButton();
    setupLeetcodeAutoClear();
  },
});

async function withProblemData<T>(
  action: (problemData: NonNullable<Awaited<ReturnType<typeof extractProblemData>>>) => Promise<T>
): Promise<T | undefined> {
  const problemData = await extractProblemData();
  if (!problemData) {
    console.error('Could not extract problem data');
    return undefined;
  }

  try {
    return await action(problemData);
  } catch (error) {
    console.error('Error processing action:', error);
    return undefined;
  }
}

function isNeetcodeHost(): boolean {
  return window.location.hostname.endsWith('neetcode.io');
}

function isLeetcodeHost(): boolean {
  return window.location.hostname.endsWith('leetcode.com');
}

function getNeetcodeSlugFromPath(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function clickResetButton(buttonContainer: HTMLElement) {
  const buttons = buttonContainer.getElementsByTagName('button');
  const resetButton = buttons.length > 4 ? buttons[3] : null;

  if (resetButton) {
    resetButton.click();
    observeConfirmButton(buttonContainer);
  }
}

function observeConfirmButton(buttonContainer: HTMLElement) {
  const editor = document.getElementById('editor');

  if (!editor) {
    return;
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const confirmButton = buttonContainer.querySelector('.text-label-r.bg-green-s');
        if (confirmButton instanceof HTMLElement) {
          confirmButton.click();
          observer.disconnect();
          break;
        }
      }
    }
  });

  observer.observe(editor, { childList: true, subtree: true });
}

async function autoResetEnabled(): Promise<boolean> {
  const data = await browser.storage.local.get('autoResetSetting');
  return Boolean(data.autoResetSetting);
}

function observeEditor() {
  const editor = document.getElementById('editor');

  if (!editor) {
    return;
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const sideButtonsContainer = editor.getElementsByClassName('flex items-center gap-1');
        const buttonContainer = sideButtonsContainer.length
          ? (sideButtonsContainer[0] as HTMLElement)
          : null;
        if (buttonContainer) {
          clickResetButton(buttonContainer);
          observer.disconnect();
          break;
        }
      }
    }
  });

  observer.observe(editor, { childList: true, subtree: true });
}

function clearNeetcodeLocalStorageForSlug(slug: string) {
  const keysToRemove: string[] = [];
  const prefix = `${slug}_`;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }
    if (key.startsWith(prefix) || key.includes(`${slug}_`)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
  });
}

function setupLeetcodeAutoClear() {
  if (!isLeetcodeHost()) {
    return;
  }

  window.onload = async () => {
    if (await autoResetEnabled()) {
      observeEditor();
    }
  };
}

function setupNeetcodeAutoClear() {
  if (!isNeetcodeHost()) {
    return;
  }

  let autoClearEnabled = false;
  let lastClearedSlug: string | null = null;
  let lastAttemptedSlug: string | null = null;

  const loadSetting = async () => {
    try {
      autoClearEnabled = await sendMessage({ type: MessageType.GET_AUTO_CLEAR_NEETCODE });
    } catch (error) {
      console.error('Failed to load NeetCode auto-clear setting:', error);
    }
  };

  const scheduleAutoClear = async () => {
    if (!autoClearEnabled) {
      return;
    }

    if (!window.location.pathname.includes('/problems/')) {
      return;
    }

    const slug = getNeetcodeSlugFromPath();
    if (!slug || slug === lastClearedSlug || slug === lastAttemptedSlug) {
      return;
    }

    lastAttemptedSlug = slug;
    clearNeetcodeLocalStorageForSlug(slug);
    lastClearedSlug = slug;
  };

  void loadSetting().then(scheduleAutoClear);

  const observer = new MutationObserver(() => {
    void scheduleAutoClear();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function setupLeetSrsButton() {
  const BUTTON_ID = 'leetsrs-button-wrapper';
  const tooltip = new Tooltip();

  function insertButton(buttonsContainer: Element) {
    // Don't insert if already present
    if (buttonsContainer.querySelector(`#${BUTTON_ID}`)) {
      return;
    }

    let ratingMenu: RatingMenu | null = null;

    const buttonWrapper = createLeetSrsButton(() => {
      if (ratingMenu) {
        ratingMenu.toggle();
      }
    });
    buttonWrapper.id = BUTTON_ID;

    // Setup rating menu
    ratingMenu = new RatingMenu(
      buttonWrapper,
      async (rating, label) => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.RATE_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            rating: rating as Grade,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
          });
          console.log(`${label} - Card rated:`, result);
          return result;
        });
      },
      async () => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.ADD_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
          });
          console.log('Add without rating - Card added:', result);
          return result;
        });
      }
    );

    // Setup tooltip
    const clickableDiv = buttonWrapper.querySelector('[data-state="closed"]') as HTMLElement;
    if (clickableDiv) {
      clickableDiv.addEventListener('mouseenter', () => {
        tooltip.show(clickableDiv, i18n.app.name);
      });

      clickableDiv.addEventListener('mouseleave', () => {
        tooltip.hide();
      });
    }

    // Insert before the last button group (the notes button)
    const lastButtonGroup = buttonsContainer.lastElementChild;

    try {
      buttonsContainer.insertBefore(buttonWrapper, lastButtonGroup);
    } catch (error) {
      console.error('Error adding LeetSRS button:', error);
    }
  }

  const tryInsertButton = () => {
    const buttonsContainer = document.querySelector('#ide-top-btns');
    if (buttonsContainer) {
      insertButton(buttonsContainer);
    }
  };
  tryInsertButton();

  // Use MutationObserver to handle SPA navigation and React re-renders.
  const observer = new MutationObserver(tryInsertButton);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function setupNeetcodeLeetSrsButton() {
  const BUTTON_ID = 'leetsrs-neetcode-button-wrapper';
  const tooltip = new Tooltip();

  function createNeetcodeLeetSrsButton(
    onClick: () => void,
    options: { fillColor?: string; backgroundColor?: string; borderColor?: string; textColor?: string }
  ): HTMLDivElement {
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.cssText = 'position: relative; display: inline-flex; align-items: center; margin-left: 10px;';

    const button = document.createElement('button');
    button.className = 'button navbar-btn';
    button.style.cssText =
      'height: 2rem; width: 2rem; min-width: 2rem; padding: 0; display: inline-flex; align-items: center; justify-content: center;';
    button.type = 'button';
    button.addEventListener('click', onClick);

    const clickableDiv = document.createElement('div');
    clickableDiv.className = 'flex cursor-pointer';
    clickableDiv.setAttribute('data-state', 'closed');
    clickableDiv.setAttribute('title', i18n.app.name);
    clickableDiv.setAttribute('aria-label', i18n.app.name);
    if (options.fillColor) {
      clickableDiv.style.color = options.fillColor;
    }
    clickableDiv.innerHTML = `
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" style="display:block;${options.fillColor ? `stroke:${options.fillColor};` : ''}">
        <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
        <path d="M5.63 7.16l0 .01" />
        <path d="M4.06 11l0 .01" />
        <path d="M4.63 15.1l0 .01" />
        <path d="M7.16 18.37l0 .01" />
        <path d="M11 19.94l0 .01" />
      </svg>
    `;

    if (options.backgroundColor) {
      button.style.backgroundColor = options.backgroundColor;
    }
    if (options.textColor) {
      button.style.color = options.textColor;
    }
    if (options.borderColor) {
      button.style.borderColor = options.borderColor;
      button.style.borderStyle = 'solid';
      button.style.borderWidth = '1px';
    } else {
      button.style.borderColor = 'transparent';
      button.style.borderStyle = 'solid';
      button.style.borderWidth = '1px';
    }
    button.appendChild(clickableDiv);
    buttonWrapper.appendChild(button);

    return buttonWrapper;
  }

  function insertButton(buttonsContainer: Element) {
    const existingWrapper = buttonsContainer.querySelector(`#${BUTTON_ID}`) as HTMLDivElement | null;
    if (existingWrapper) {
      const submitButton = buttonsContainer.querySelector('button.is-success');
      if (!submitButton) {
        existingWrapper.style.display = 'none';
        return;
      }
      const isSubmitting =
        submitButton.classList.contains('is-loading') ||
        submitButton.getAttribute('aria-busy') === 'true' ||
        submitButton.hasAttribute('disabled');
      existingWrapper.style.display = isSubmitting ? 'none' : 'inline-flex';
      if (submitButton.nextElementSibling !== existingWrapper) {
        submitButton.insertAdjacentElement('afterend', existingWrapper);
      }
      return;
    }

    let ratingMenu: RatingMenu | null = null;

    const buttonWrapper = createNeetcodeLeetSrsButton(
      () => {
        if (ratingMenu) {
          ratingMenu.toggle();
        }
      },
      {
        fillColor: 'rgb(40, 194, 68)',
        backgroundColor: 'var(--code-editor-language-btn-background-color)',
        borderColor: 'var(--code-editor-language-btn-background-color)',
      }
    );
    buttonWrapper.id = BUTTON_ID;
    buttonWrapper.style.display = 'inline-flex';
    buttonWrapper.style.alignItems = 'center';
    buttonWrapper.style.marginLeft = '10px';

    ratingMenu = new RatingMenu(
      buttonWrapper,
      async (rating, label) => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.RATE_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            rating: rating as Grade,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
          });
          console.log(`${label} - Card rated:`, result);
          return result;
        });
      },
      async () => {
        await withProblemData(async (problemData) => {
          const result = await sendMessage({
            type: MessageType.ADD_CARD,
            slug: problemData.titleSlug,
            name: problemData.title,
            leetcodeId: problemData.questionFrontendId,
            difficulty: problemData.difficulty,
          });
          console.log('Add without rating - Card added:', result);
          return result;
        });
      },
      { position: 'top' }
    );

    const clickableDiv = buttonWrapper.querySelector('[data-state="closed"]') as HTMLElement;
    if (clickableDiv) {
      clickableDiv.addEventListener('mouseenter', () => {
        tooltip.show(clickableDiv, i18n.app.name);
      });

      clickableDiv.addEventListener('mouseleave', () => {
        tooltip.hide();
      });
    }

    try {
      const submitButton = buttonsContainer.querySelector('button.is-success');
      if (submitButton) {
        const isSubmitting =
          submitButton.classList.contains('is-loading') ||
          submitButton.getAttribute('aria-busy') === 'true' ||
          submitButton.hasAttribute('disabled');
        if (isSubmitting) {
          buttonWrapper.style.display = 'none';
        }
        submitButton.insertAdjacentElement('afterend', buttonWrapper);
      } else {
        buttonsContainer.appendChild(buttonWrapper);
      }
    } catch (error) {
      console.error('Error adding LeetSRS button on NeetCode:', error);
    }
  }

  const tryInsertButton = () => {
    const buttonsContainer = document.querySelector('.submit-toolbar > div');
    if (buttonsContainer) {
      insertButton(buttonsContainer);
    }
  };

  tryInsertButton();

  const observer = new MutationObserver(tryInsertButton);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
