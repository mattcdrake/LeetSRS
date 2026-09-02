import type { Grade } from 'ts-fsrs';
import { getServiceTranslations, initializeServiceTranslations } from '@/services/i18n';
import type { ProblemDescriptor } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import type { ProblemData } from '@/shared/problem-data';
import {
  createLeetSrsButton,
  extractProblemData,
  getCurrentDomain,
  RatingMenu,
  setupLeetcodeAutoReset,
  Tooltip,
} from '@/utils/content';

export default defineContentScript({
  matches: ['*://*.leetcode.com/*', '*://*.leetcode.cn/*'],
  runAt: 'document_idle',
  async main() {
    // Wake up service worker so it's ready when user interacts
    try {
      await sendMessage('ping');
    } catch (error) {
      console.error('Failed to ping service worker:', error);
    }
    await initializeServiceTranslations();
    setupLeetSrsButton();
    setupLeetcodeAutoReset();
  },
});

function toProblemDescriptor(problemData: ProblemData): ProblemDescriptor {
  return {
    slug: problemData.titleSlug,
    name: problemData.title,
    leetcodeId: problemData.questionFrontendId,
    difficulty: problemData.difficulty,
    domain: getCurrentDomain(),
  };
}

async function withProblemData<T>(action: (problem: ProblemDescriptor) => Promise<T>): Promise<T | undefined> {
  const problemData = await extractProblemData();
  if (!problemData) {
    console.error('Could not extract problem data');
    return undefined;
  }

  try {
    return await action(toProblemDescriptor(problemData));
  } catch (error) {
    console.error('Error processing action:', error);
    return undefined;
  }
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
        await withProblemData(async (problem) => {
          const result = await sendMessage('rateCard', {
            input: { ...problem, rating: rating as Grade },
          });
          console.log(`${label} - Card rated:`, result);
          return result;
        });
      },
      async () => {
        await withProblemData(async (problem) => {
          const result = await sendMessage('addCard', { problem });
          console.log('Add without rating - Card added:', result);
          return result;
        });
      }
    );

    // Setup tooltip
    const t = getServiceTranslations();
    const clickableDiv = buttonWrapper.querySelector('[data-state="closed"]') as HTMLElement;
    if (clickableDiv) {
      clickableDiv.addEventListener('mouseenter', () => {
        tooltip.show(clickableDiv, t.app.name);
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
